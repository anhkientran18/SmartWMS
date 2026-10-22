using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Features.InboundReceipts.Commands.UpdateInboundReceipt;
using SmartWMS.Application.Features.InboundReceipts.DTOs.Commands;
using SmartWMS.Application.Features.Zones.Commands.CreateZone;
using SmartWMS.Application.Features.Zones.Commands.DeleteZone;
using SmartWMS.Application.Features.Zones.DTOs.Commands;
using SmartWMS.Application.Features.Bins.Commands.CreateBin;
using SmartWMS.Application.Features.Bins.DTOs.Commands;
using SmartWMS.Application.Features.Users.Commands;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums;
using SmartWMS.Infrastructure.Persistence.DbContext;
using SmartWMS.Infrastructure.Persistence.Repositories;
using SmartWMS.Infrastructure.Services;

if (args.Length == 2 && args[0] == "--verify-delete-races")
{
    await DeleteRaceVerification.RunAsync(args[1]);
    return;
}
if (args.Length != 2 || args[0] != "--verify-localdb")
    throw new ArgumentException("Usage: --verify-localdb <report-directory>");
var report = Path.GetFullPath(args[1]);
Directory.CreateDirectory(report);
var database = "SmartWMS_ReleaseFix_Verify_" + Guid.NewGuid().ToString("N");
var connection = $"Server=(localdb)\\MSSQLLocalDB;Database={database};Integrated Security=true;TrustServerCertificate=true;Encrypt=false";
var results = new List<string>();
void Check(bool ok, string label)
{
    if (!ok) throw new Exception("FAIL: " + label);
    results.Add("PASS: " + label); Console.WriteLine(results[^1]);
}
ApplicationDbContext Db(params IInterceptor[] interceptors) => new(new DbContextOptionsBuilder<ApplicationDbContext>()
    .UseSqlServer(connection).AddInterceptors(interceptors).Options, new FixtureUser());
UpdateInboundReceiptCommandHandler Handler(ApplicationDbContext db) =>
    new(new UnitOfWork(db), db, new InventoryMutationCoordinator(db));
var p1 = Guid.NewGuid(); var p2 = Guid.NewGuid(); var p3 = Guid.NewGuid();
var supplier = Guid.NewGuid(); var warehouse = Guid.NewGuid(); var zone = Guid.NewGuid(); var bin = Guid.NewGuid();
var expiry = new DateTime(2027, 10, 22, 0, 0, 0, DateTimeKind.Utc);
async Task<Guid> Receipt(string status = "New", bool duplicate = false, int received = 0)
{
    await using var db = Db();
    var receipt = new InboundReceipt { ReceiptNumber = Guid.NewGuid().ToString("N"), Status = status,
        SupplierId = supplier, BinId = bin, ExpectedDeliveryDate = DateTime.UtcNow.AddDays(1), Notes = "before" };
    receipt.Items.Add(new InboundReceiptItem { ProductId = p1, QuantityExpected = 10,
        QuantityReceived = received, LotNumber = "LOT-PRESERVE", ExpirationDate = expiry });
    receipt.Items.Add(new InboundReceiptItem { ProductId = duplicate ? p1 : p2, QuantityExpected = 20, LotNumber = "LOT-REMOVE" });
    db.InboundReceipts.Add(receipt); await db.SaveChangesAsync(); return receipt.Id;
}
UpdateInboundReceiptCommand Command(Guid id) => new(new UpdateInboundReceiptRequest
{
    Id = id, SupplierId = supplier, BinId = bin, Notes = "updated", ReferenceDocument = "updated-reference",
    ExpectedDeliveryDate = DateTime.UtcNow.Date.AddDays(2),
    Items = [new() { ProductId = p1, ExpectedQuantity = 12 }, new() { ProductId = p3, ExpectedQuantity = 5 }]
});
async Task Reject(Guid id, string label)
{
    var before = await Snapshot(connection);
    await using var db = Db();
    var result = await Handler(db).Handle(Command(id), default);
    Check(!result.IsSuccess, label);
    Check(db.Database.CurrentTransaction == null && !db.ChangeTracker.Entries().Any(), label + ": transaction disposed/tracker clear");
    Check(before == await Snapshot(connection), label + ": no header/item/audit/inventory mutation");
}
try
{
    await using (var db = Db())
    {
        // Isolated blank fixture from the current model; no migration or business DB access.
        await db.Database.EnsureCreatedAsync();
        Check(!db.Database.HasPendingModelChanges(), "no EF model changes; no migration required");
        db.Warehouses.Add(new Warehouse { Id = warehouse, Code = "FIX-W", Name = "fixture" });
        db.Zones.Add(new Zone { Id = zone, Code = "FIX-Z", Name = "fixture", WarehouseId = warehouse });
        db.Bins.Add(new Bin { Id = bin, Code = "FIX-B", ZoneId = zone, MaxCapacity = 100, CurrentOccupancy = 5 });
        db.Suppliers.Add(new Supplier { Id = supplier, Code = "FIX-S", Name = "fixture" });
        foreach (var id in new[] { p1, p2, p3 })
            db.Products.Add(new Product { Id = id, SKU = id.ToString(), Barcode = id.ToString(), Name = "fixture" });
        db.BinInventories.Add(new BinInventory { BinId = bin, ProductId = p1, Quantity = 5, LotNumber = "EXISTING-STOCK", Status = InventoryStatus.Available });
        await db.SaveChangesAsync();
    }
    foreach (var status in new[] { "New", "Draft", "Pending" })
    {
        var id = await Receipt(status);
        Guid retained; Guid removed;
        await using (var db = Db())
        {
            var old = await db.Set<InboundReceiptItem>().Where(x => x.InboundReceiptId == id).ToListAsync();
            retained = old.Single(x => x.ProductId == p1).Id; removed = old.Single(x => x.ProductId == p2).Id;
        }
        var states = new CaptureStates(id, p1, p2, p3);
        await using (var db = Db(states))
        {
            var result = await Handler(db).Handle(Command(id), default);
            Check(result.IsSuccess, status + " valid handler update succeeds");
            Check(states.Correct, status + " EF states: retained Modified / removed Deleted / new Added");
        }
        await using (var db = Db())
        {
            var receipt = await db.InboundReceipts.Include(x => x.Items).SingleAsync(x => x.Id == id);
            var keep = receipt.Items.Single(x => x.ProductId == p1);
            var added = receipt.Items.Single(x => x.ProductId == p3);
            Check(receipt.Status == status && receipt.Notes == "updated" && receipt.ReferenceDocument == "updated-reference", status + " header values/status preserved");
            Check(keep.Id == retained && keep.QuantityExpected == 12 && keep.LotNumber == "LOT-PRESERVE" && keep.ExpirationDate == expiry,
                status + " retained Id/lot/expiry preserved and expected quantity updated");
            Check(!await db.Set<InboundReceiptItem>().AnyAsync(x => x.Id == removed) && receipt.Items.Count == 2,
                status + " removed detail deleted, no duplicate children");
            Check(added.QuantityExpected == 5 && added.QuantityReceived == 0 && added.LotNumber == "" && added.ExpirationDate == null,
                status + " new detail uses current DTO defaults");
            var stock = await db.BinInventories.SingleAsync();
            Check(stock.Quantity == 5 && (await db.Bins.SingleAsync(x => x.Id == bin)).CurrentOccupancy == 5 &&
                !await db.InventoryTransactions.AnyAsync(), status + " no inventory/occupancy/ledger mutation");
        }
    }
    foreach (var status in new[] { "Processing", "Completed", "Cancelled" }) await Reject(await Receipt(status), status + " update forbidden");
    await Reject(await Receipt(duplicate: true), "ambiguous existing product/lot identity rejects");
    await Reject(await Receipt(received: 1), "received progress rejects even if header says New");

    foreach (var conflict in new[] { true, false })
    {
        var id = await Receipt(); var before = await Snapshot(connection);
        await using var db = Db(new FailAfterSql(conflict));
        if (conflict)
        {
            var result = await Handler(db).Handle(Command(id), default);
            Check(!result.IsSuccess && result.Error?.Code == "COM_409", "post-SQL concurrency fault maps COM_409");
        }
        else
        {
            try { await Handler(db).Handle(Command(id), default); throw new Exception("Expected controlled fault"); }
            catch (InvalidOperationException ex) when (ex.Message == "Controlled post-SQL fault") { Check(true, "unexpected post-SQL fault propagates after rollback"); }
        }
        Check(!db.ChangeTracker.Entries().Any() && db.Database.CurrentTransaction == null, "fault clears tracker/disposes transaction");
        Check(before == await Snapshot(connection), "post-SQL fault rolls back all header/details/audit writes");
        Check(await db.InboundReceipts.AnyAsync(), "connection/context usable after rollback");
    }

    var invalidId = await Receipt();
    foreach (var kind in new[] { "missing product", "missing supplier", "missing bin", "duplicate requested product" })
    {
        var command = Command(invalidId);
        if (kind == "missing product") command.RequestData.Items[0].ProductId = Guid.NewGuid();
        if (kind == "missing supplier") command.RequestData.SupplierId = Guid.NewGuid();
        if (kind == "missing bin") command.RequestData.BinId = Guid.NewGuid();
        if (kind == "duplicate requested product") command.RequestData.Items[1].ProductId = p1;
        var before = await Snapshot(connection);
        await using var db = Db();
        Check(!(await Handler(db).Handle(command, default)).IsSuccess, kind + " rejects");
        Check(before == await Snapshot(connection), kind + " no mutation");
    }

    var deletedWarehouse = Guid.NewGuid(); var deletedZone = Guid.NewGuid(); var invalidHierarchyZone = Guid.NewGuid();
    var historicalZone = Guid.NewGuid(); var countOnlyZone = Guid.NewGuid(); var referencedUser = Guid.NewGuid(); var freeUser = Guid.NewGuid();
    await using (var db = Db())
    {
        db.Warehouses.Add(new Warehouse { Id = deletedWarehouse, Code = "DELETED-W", Name = "fixture", IsDeleted = true });
        db.Zones.AddRange(new Zone { Id = deletedZone, Code = "DELETED-Z", Name = "fixture", WarehouseId = warehouse, IsDeleted = true },
            new Zone { Id = invalidHierarchyZone, Code = "DELETED-PARENT", Name = "fixture", WarehouseId = deletedWarehouse },
            new Zone { Id = historicalZone, Code = "HISTORY", Name = "fixture", WarehouseId = warehouse },
            new Zone { Id = countOnlyZone, Code = "COUNT-ONLY", Name = "fixture", WarehouseId = warehouse });
        db.Bins.Add(new Bin { ZoneId = historicalZone, Code = "SOFT-DELETED-BIN", IsDeleted = true, MaxCapacity = 100 });
        db.Users.AddRange(new User { Id = referencedUser, Username = "referenced", Email = "fixture1@example.invalid" },
            new User { Id = freeUser, Username = "unreferenced", Email = "fixture2@example.invalid" });
        db.CycleCountSheets.Add(new CycleCountSheet { ZoneId = countOnlyZone, AssignedUserId = referencedUser, IsDeleted = true, Status = "Completed" });
        await db.SaveChangesAsync();
    }
    foreach (var parent in new[] { Guid.NewGuid(), deletedWarehouse })
    {
        await using var db = Db();
        var result = await new CreateZoneCommandHandler(new UnitOfWork(db), db, new InventoryMutationCoordinator(db))
            .Handle(new(new CreateZoneRequest { Code = Guid.NewGuid().ToString(), Name = "fixture", WarehouseId = parent }), default);
        Check(!result.IsSuccess && !db.ChangeTracker.Entries().Any(), "Zone nonexistent/deleted warehouse rejects before save");
    }
    foreach (var parent in new[] { Guid.NewGuid(), deletedZone, invalidHierarchyZone })
    {
        await using var db = Db();
        var result = await new CreateBinCommandHandler(new UnitOfWork(db), db, new InventoryMutationCoordinator(db))
            .Handle(new(new CreateBinRequest { Code = Guid.NewGuid().ToString(), ZoneId = parent, MaxCapacity = 100 }), default);
        Check(!result.IsSuccess && !db.ChangeTracker.Entries().Any(), "Bin missing/deleted Zone or deleted Warehouse rejects");
    }
    foreach (var id in new[] { historicalZone, countOnlyZone })
    {
        var before = await Snapshot(connection); await using var db = Db();
        var result = await new DeleteZoneCommandHandler(new UnitOfWork(db), db, new InventoryMutationCoordinator(db))
            .Handle(new(new DeleteZoneRequest { Id = id }), default);
        Check(!result.IsSuccess && result.Error?.Code == "COM_409", "historical bin/count zone delete business conflict");
        Check(before == await Snapshot(connection), "zone delete reject preserves all history");
    }
    await using (var db = Db())
    {
        var result = await new DeleteUserCommandHandler(db, new InventoryMutationCoordinator(db)).Handle(new(referencedUser), default);
        Check(!result.IsSuccess && result.Error?.Code == "COM_409" && await db.Users.AnyAsync(x => x.Id == referencedUser),
            "referenced User delete rejects, preserves account and historical sheet");
    }
    await using (var db = Db())
        Check((await new DeleteUserCommandHandler(db, new InventoryMutationCoordinator(db)).Handle(new(freeUser), default)).IsSuccess,
            "unreferenced User deletion retains existing semantics");
}
finally
{
    SqlConnection.ClearAllPools();
    if (!database.StartsWith("SmartWMS_ReleaseFix_Verify_", StringComparison.Ordinal) ||
        database.Length != "SmartWMS_ReleaseFix_Verify_".Length + 32)
        throw new Exception("Unexpected fixture cleanup target");
    await using var master = new SqlConnection("Server=(localdb)\\MSSQLLocalDB;Database=master;Integrated Security=true;TrustServerCertificate=true;Encrypt=false");
    await master.OpenAsync(); await using var command = master.CreateCommand();
    command.CommandText = $"IF DB_ID(N'{database}') IS NOT NULL BEGIN ALTER DATABASE [{database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{database}]; END";
    await command.ExecuteNonQueryAsync();
    command.CommandText = $"SELECT COUNT(*) FROM sys.databases WHERE name=N'{database}'";
    Check((int)(await command.ExecuteScalarAsync())! == 0, "isolated fixture database cleanup verified");
    await File.WriteAllLinesAsync(Path.Combine(report, "handler-results.txt"), results);
}
Console.WriteLine($"ALL {results.Count} HANDLER CHECKS PASSED");

static async Task<string> Snapshot(string connection)
{
    await using var c = new SqlConnection(connection); await c.OpenAsync();
    var tables = new List<string>(); await using var cmd = c.CreateCommand();
    cmd.CommandText = "SELECT QUOTENAME(SCHEMA_NAME(schema_id))+N'.'+QUOTENAME(name) FROM sys.tables ORDER BY 1";
    await using (var r = await cmd.ExecuteReaderAsync()) while (await r.ReadAsync()) tables.Add(r.GetString(0));
    var data = new List<string>();
    foreach (var table in tables)
    {
        cmd.CommandText = $"SELECT * FROM {table}";
        var rows = new List<string>();
        await using var r = await cmd.ExecuteReaderAsync();
        while (await r.ReadAsync())
        {
            var values = new object[r.FieldCount]; r.GetValues(values);
            rows.Add(JsonSerializer.Serialize(values.Select(v => v is DBNull ? null : v is byte[] b ? Convert.ToHexString(b) : v)));
        }
        rows.Sort(StringComparer.Ordinal); data.Add(table + ":" + string.Join("\n", rows));
    }
    return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(string.Join("\n", data))));
}

sealed class FixtureUser : ICurrentUserService
{
    public string UserId => "ReleaseFixVerification";
    public string Role => "Admin";
    public string IpAddress => "127.0.0.1";
}
sealed class CaptureStates(Guid receipt, Guid retained, Guid removed, Guid added) : SaveChangesInterceptor
{
    public bool Correct { get; private set; }
    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData,
        InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        var context = eventData.Context!; context.ChangeTracker.DetectChanges();
        var entries = context.ChangeTracker.Entries<InboundReceiptItem>().Where(x => x.Entity.InboundReceiptId == receipt).ToList();
        Correct = entries.Count == 3 && entries.Any(x => x.Entity.ProductId == retained && x.State == EntityState.Modified) &&
            entries.Any(x => x.Entity.ProductId == removed && x.State == EntityState.Deleted) &&
            entries.Any(x => x.Entity.ProductId == added && x.State == EntityState.Added);
        return ValueTask.FromResult(result);
    }
}
sealed class FailAfterSql(bool conflict) : SaveChangesInterceptor
{
    public override ValueTask<int> SavedChangesAsync(SaveChangesCompletedEventData eventData, int result,
        CancellationToken cancellationToken = default) => throw (conflict
        ? (Exception)new DbUpdateConcurrencyException("Controlled post-SQL conflict")
        : new InvalidOperationException("Controlled post-SQL fault"));
}
