using System.Data.Common;
using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InboundReceipts.Commands.ReceiveInboundReceipt;
using SmartWMS.Application.Features.InboundReceipts.DTOs.Commands;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums;
using SmartWMS.Infrastructure.Persistence.DbContext;
using SmartWMS.Infrastructure.Services;

// No business database connection: all migrations, mutations and cleanup target this generated fixture only.
if (args.Length is not (2 or 3) || args[0] != "--verify-localdb")
    throw new ArgumentException("Usage: --verify-localdb <report-directory> [absolute-api-dll-path]");
var report = Path.GetFullPath(args[1]); Directory.CreateDirectory(report);
const string prefix = "SmartWMS_InboundB1_Verify_";
var database = prefix + Guid.NewGuid().ToString("N");
var connection = $"Server=(localdb)\\MSSQLLocalDB;Database={database};Integrated Security=true;TrustServerCertificate=true;Encrypt=false";
var results = new List<string>();
void Check(bool ok, string label)
{
    if (!ok) { results.Add("FAIL: " + label); throw new Exception(results[^1]); }
    results.Add("PASS: " + label); Console.WriteLine(results[^1]);
}
ApplicationDbContext Db(params IInterceptor[] interceptors) => new(new DbContextOptionsBuilder<ApplicationDbContext>()
    .UseSqlServer(connection).AddInterceptors(interceptors).Options, new VerifyUser());
ReceiveInboundReceiptCommandHandler Handler(ApplicationDbContext db, NotificationProbe? probe = null, LogProbe? log = null) =>
    new(db, new InventoryMutationCoordinator(db), new InboundReceiveCoordinator(db), probe ?? new(), log ?? new());
var expiry = DateTime.UtcNow.Date.AddDays(365);
async Task<Fixture> Fixture(int stock = 0, double capacity = 100, ProductTrackingMode mode = ProductTrackingMode.Lot)
{
    await using var db = Db(); var tag = Guid.NewGuid().ToString("N");
    var warehouse = new Warehouse { Code = "W" + tag, Name = tag };
    var zone = new Zone { Code = "Z" + tag, Name = tag, Warehouse = warehouse };
    var bin = new Bin { Id = Guid.NewGuid(), Code = "B" + tag, Zone = zone, MaxCapacity = capacity, CurrentOccupancy = stock };
    var product = new Product { SKU = tag, Barcode = tag, Name = tag, TrackingMode = mode };
    var supplier = new Supplier { Code = tag, Name = tag };
    var receipt = new InboundReceipt { ReceiptNumber = tag, Bin = bin, Supplier = supplier, Status = "New",
        Items = [new InboundReceiptItem { Product = product, QuantityExpected = 10, LotNumber = " LOT-B1 ", ExpirationDate = expiry }] };
    db.InboundReceipts.Add(receipt);
    if (stock > 0) db.BinInventories.Add(new BinInventory { Bin = bin, Product = product,
        LotNumber = "LOT-B1", ExpirationDate = expiry, Quantity = stock, Status = InventoryStatus.Available });
    await db.SaveChangesAsync();
    return new(receipt.Id, receipt.Items.Single().Id, bin.Id, product.Id, zone.Id, warehouse.Id, supplier.Id);
}
ReceiveInboundReceiptCommand Command(Fixture f, int delta = 4, int? before = 0) => new(new ReceiveInboundReceiptRequest
{
    InboundReceiptId = f.Receipt, ReceivedItems = [new() { ItemId = f.Item, QuantityReceived = delta, ExpectedReceivedQuantity = before }]
});
async Task<Result<bool>> Receive(Fixture f, int delta = 4, int? before = 0)
{
    await using var db = Db(); return await Handler(db).Handle(Command(f, delta, before), default);
}
async Task Mutate(Action<ApplicationDbContext> change) { await using var db = Db(); change(db); await db.SaveChangesAsync(); }
async Task Reject(ReceiveInboundReceiptCommand command, string label, string? code = null)
{
    var before = await Snapshot(connection); await using var db = Db();
    var response = await Handler(db).Handle(command, default);
    Check(!response.IsSuccess && (code == null || response.Error?.Code == code), label);
    Check(before == await Snapshot(connection), label + ": all stock/occupancy/history/receipt/audit unchanged");
    Check(db.Database.CurrentTransaction == null && !db.ChangeTracker.Entries().Any(), label + ": transaction disposed/tracker clear");
}

try
{
    await using (var db = Db())
    {
        // Real historical migration chain on a disposable database, including the inventory-empty path.
        await PrepareMigratedFixture(db);
        Check(!db.Database.HasPendingModelChanges(), "EF model matches snapshot; B1 requires no migration");
        Check(!(await db.Database.GetPendingMigrationsAsync()).Any(), "fixture migrated through the real historical chain; no synthetic history baseline");
    }
    var normal = await Fixture();
    Check((await Receive(normal)).IsSuccess, "first partial receive succeeds");
    await using (var db = Db())
    {
        var r = await db.InboundReceipts.Include(x => x.Items).SingleAsync(x => x.Id == normal.Receipt);
        var s = await db.BinInventories.SingleAsync(x => x.BinId == normal.Bin);
        Check(r.Status == "Processing" && r.Items.Single().QuantityReceived == 4 && s.Quantity == 4 &&
            s.LotNumber == "LOT-B1" && s.Status == InventoryStatus.Available && s.ExpirationDate == expiry &&
            (await db.Bins.SingleAsync(x => x.Id == normal.Bin)).CurrentOccupancy == 4, "partial quantity/lot/status/expiry/occupancy consistent");
        Check(r.Items.Single().TrackingModeSnapshot == ProductTrackingMode.Lot, "tracking evidence persisted on receipt item");
        var ledger = await db.InventoryTransactions.SingleAsync(x => x.BinInventoryId == s.Id);
        Check(ledger.QuantityChanged == 4 && ledger.ReasonCode.Contains(normal.Item.ToString("N")) &&
            ledger.ReasonCode.Contains(normal.Receipt.ToString("N")) && ledger.CreatedBy == VerifyUser.Id,
            "history references inventory, receipt, item and authenticated actor");
        Check(await db.AuditLogs.AnyAsync(x => x.TableName == "InboundReceipts" && x.Type == "U" && x.UserId == VerifyUser.Id), "receipt audit committed");
    }
    await Reject(Command(normal), "retry after partial success conflicts", "COM_409");
    await Reject(Command(normal, 7, 4), "over-receive rejects");
    Check((await Receive(normal, 6, 4)).IsSuccess, "second/final receive succeeds");
    await using (var db = Db()) Check((await db.InboundReceipts.FindAsync(normal.Receipt))!.Status == "Completed" &&
        (await db.BinInventories.SingleAsync(x => x.BinId == normal.Bin)).Quantity == 10 &&
        (await db.Bins.FindAsync(normal.Bin))!.CurrentOccupancy == 10, "final receipt/stock/occupancy committed together");
    await Reject(Command(normal, 6, 4), "retry after final success conflicts", "COM_409");

    var duplicate = await Fixture(); var duplicateCommand = Command(duplicate);
    duplicateCommand.RequestData.ReceivedItems.Add(new() { ItemId = duplicate.Item, QuantityReceived = 1, ExpectedReceivedQuantity = 0 });
    await Reject(duplicateCommand, "duplicate detail IDs reject before mutation");
    await Reject(Command(duplicate, 4, null), "missing retry precondition rejects");
    Check(!(await new ReceiveInboundReceiptCommandValidator().ValidateAsync(Command(duplicate, 4, null))).IsValid,
        "MVC validation rejects missing expectedReceivedQuantity");
    await Reject(Command(duplicate, 0), "zero delta rejects");
    var foreign = Command(duplicate); foreign.RequestData.ReceivedItems[0].ItemId = Guid.NewGuid();
    await Reject(foreign, "foreign detail rejects");
    var capacity = await Fixture(capacity: 3); await Reject(Command(capacity), "capacity overflow rejects");
    var overflow = await Fixture(stock: int.MaxValue, capacity: (double)int.MaxValue + 100);
    await Reject(Command(overflow, 1), "inventory integer overflow rejects without mutation");
    var drift = await Fixture(stock: 2);
    await Mutate(db => db.Bins.Single(x => x.Id == drift.Bin).CurrentOccupancy = 1);
    await Reject(Command(drift), "existing stock/occupancy drift rejects without repair", "COM_409");
    var whitespace = await Fixture(stock: 2);
    await Mutate(db => db.BinInventories.Single(x => x.BinId == whitespace.Bin).LotNumber = "\tLOT-B1\u00a0");
    Check((await Receive(whitespace, 2)).IsSuccess, "lot lookup normalizes tab and Unicode whitespace consistently");
    await using (var db = Db()) Check(await db.BinInventories.CountAsync(x => x.BinId == whitespace.Bin) == 1 &&
        (await db.BinInventories.SingleAsync(x => x.BinId == whitespace.Bin)).Quantity == 4, "normalized lot receive does not create duplicate identity");

    var batch = await Fixture(stock: 2); Guid secondDetail;
    await using (var db = Db())
    {
        var extra = new InboundReceiptItem { InboundReceiptId = batch.Receipt, ProductId = batch.Product,
            QuantityExpected = 10, LotNumber = "LOT-B1", ExpirationDate = expiry };
        db.InboundReceiptItems.Add(extra); await db.SaveChangesAsync(); secondDetail = extra.Id;
    }
    var batchCommand = Command(batch, 3);
    batchCommand.RequestData.ReceivedItems.Add(new() { ItemId = secondDetail, QuantityReceived = 2, ExpectedReceivedQuantity = 0 });
    await using (var db = Db()) Check((await Handler(db).Handle(batchCommand, default)).IsSuccess, "multiple details sharing same Available identity receive once per detail");
    await using (var db = Db()) Check((await db.BinInventories.SingleAsync(x => x.BinId == batch.Bin)).Quantity == 7 &&
        (await db.Bins.FindAsync(batch.Bin))!.CurrentOccupancy == 7, "shared-identity batch preserves aggregate stock/occupancy");
    await Mutate(db => db.InboundReceiptItems.Single(x => x.Id == secondDetail).ExpirationDate = expiry.AddDays(1));
    batchCommand = Command(batch, 1, 3);
    batchCommand.RequestData.ReceivedItems.Add(new() { ItemId = secondDetail, QuantityReceived = 1, ExpectedReceivedQuantity = 2 });
    await Reject(batchCommand, "later detail metadata mismatch rejects entire batch", "COM_409");

    var statuses = await Fixture(stock: 3);
    await Mutate(db =>
    {
        foreach (var status in new[] { InventoryStatus.Reserved, InventoryStatus.QCHold, InventoryStatus.Damaged, InventoryStatus.Expired })
            db.BinInventories.Add(new BinInventory { BinId = statuses.Bin, ProductId = statuses.Product, LotNumber = "LOT-B1",
                ExpirationDate = expiry, Quantity = 2, Status = status });
        db.Bins.Single(x => x.Id == statuses.Bin).CurrentOccupancy += 8;
    });
    Check((await Receive(statuses, 2)).IsSuccess, "receive selects Available among multiple stock statuses");
    await using (var db = Db()) Check(await db.BinInventories.Where(x => x.BinId == statuses.Bin)
        .AllAsync(x => x.Quantity == (x.Status == InventoryStatus.Available ? 5 : 2)), "held/reserved/damaged/expired rows never incremented");
    var heldOnly = await Fixture(stock: 2);
    await Mutate(db => db.BinInventories.Single(x => x.BinId == heldOnly.Bin).Status = InventoryStatus.QCHold);
    Check((await Receive(heldOnly, 2)).IsSuccess, "held-only identity creates separate Available row");
    await using (var db = Db()) Check(await db.BinInventories.CountAsync(x => x.BinId == heldOnly.Bin) == 2 &&
        await db.BinInventories.Where(x => x.BinId == heldOnly.Bin).AllAsync(x => x.Quantity == 2), "held-only original quantity preserved");

    foreach (var kind in new[] { "expiry", "lpn", "reserved", "serial-evidence", "ambiguous-lot" })
    {
        var f = await Fixture(stock: 2);
        await Mutate(db =>
        {
            var stock = db.BinInventories.Single(x => x.BinId == f.Bin);
            if (kind == "expiry") stock.ExpirationDate = expiry.AddDays(1);
            if (kind == "lpn") stock.LpnCode = "LPN-EVIDENCE";
            if (kind == "reserved") stock.ReservedQuantity = 1;
            if (kind == "serial-evidence") db.ProductSerialNumbers.Add(new ProductSerialNumber
                { ProductId = f.Product, BinInventoryId = stock.Id, SerialCode = Guid.NewGuid().ToString("N") });
            if (kind == "ambiguous-lot") db.BinInventories.Add(new BinInventory { BinId = f.Bin, ProductId = f.Product,
                LotNumber = " LOT-B1", ExpirationDate = expiry, Status = InventoryStatus.Available, Quantity = 0 });
        });
        await Reject(Command(f), kind + " mismatch/evidence rejects", "COM_409");
    }
    foreach (var kind in new[] { "bin", "zone", "warehouse", "product", "supplier", "receipt", "cancelled", "draft", "no-bin", "expired", "tracking-snapshot" })
    {
        var f = await Fixture();
        await Mutate(db =>
        {
            if (kind == "bin") db.Bins.Single(x => x.Id == f.Bin).IsDeleted = true;
            if (kind == "zone") db.Zones.Single(x => x.Id == f.Zone).IsDeleted = true;
            if (kind == "warehouse") db.Warehouses.Single(x => x.Id == f.Warehouse).IsDeleted = true;
            if (kind == "product") db.Products.Single(x => x.Id == f.Product).IsDeleted = true;
            if (kind == "supplier") db.Suppliers.Single(x => x.Id == f.Supplier).IsDeleted = true;
            if (kind == "receipt") db.InboundReceipts.Single(x => x.Id == f.Receipt).IsDeleted = true;
            if (kind is "cancelled" or "draft") db.InboundReceipts.Single(x => x.Id == f.Receipt).Status = kind == "draft" ? "Draft" : "Cancelled";
            if (kind == "no-bin") db.InboundReceipts.Single(x => x.Id == f.Receipt).BinId = null;
            if (kind == "expired") db.InboundReceiptItems.Single(x => x.Id == f.Item).ExpirationDate = DateTime.UtcNow.AddDays(-1);
            if (kind == "tracking-snapshot") db.InboundReceiptItems.Single(x => x.Id == f.Item).TrackingModeSnapshot = ProductTrackingMode.None;
        });
        await Reject(Command(f), "invalid/deleted " + kind + " rejects");
    }
    var serial = await Fixture(mode: ProductTrackingMode.Serial);
    await Reject(Command(serial), "unsupported Serial explicitly rejects");
    var untracked = await Fixture(mode: ProductTrackingMode.None);
    Check((await Receive(untracked)).IsSuccess, "None tracking supported without serial evidence");

    var concurrent = await Fixture();
    var races = await Task.WhenAll(Receive(concurrent, 6), Receive(concurrent, 6));
    Check(races.Count(x => x.IsSuccess) == 1 && races.Count(x => x.Error?.Code == "COM_409") == 1,
        "concurrent same-receipt receives: one success, one COM_409");
    await using (var db = Db()) Check((await db.InboundReceiptItems.FindAsync(concurrent.Item))!.QuantityReceived == 6 &&
        (await db.BinInventories.SingleAsync(x => x.BinId == concurrent.Bin)).Quantity == 6 &&
        (await db.Bins.FindAsync(concurrent.Bin))!.CurrentOccupancy == 6, "concurrent receives never overrun expected quantity or occupancy");

    var shared = await Fixture(capacity: 6);
    Guid otherReceipt; Guid otherItem;
    await using (var db = Db())
    {
        var r = new InboundReceipt { BinId = shared.Bin, SupplierId = shared.Supplier, ReceiptNumber = Guid.NewGuid().ToString("N"), Status = "New",
            Items = [new InboundReceiptItem { ProductId = shared.Product, QuantityExpected = 10, LotNumber = "OTHER-LOT", ExpirationDate = expiry }] };
        db.InboundReceipts.Add(r); await db.SaveChangesAsync(); otherReceipt = r.Id; otherItem = r.Items.Single().Id;
    }
    var other = shared with { Receipt = otherReceipt, Item = otherItem };
    var capacityRace = await Task.WhenAll(Receive(shared, 4), Receive(other, 4));
    Check(capacityRace.Count(x => x.IsSuccess) == 1, "different receipts sharing bin cannot both overrun capacity");
    await using (var db = Db()) Check((await db.Bins.FindAsync(shared.Bin))!.CurrentOccupancy == 4 &&
        await db.BinInventories.Where(x => x.BinId == shared.Bin).SumAsync(x => x.Quantity) == 4, "shared-bin capacity race keeps stock/occupancy consistent");

    var notify = await Fixture(); var notificationProbe = new NotificationProbe { Fail = true }; var logs = new LogProbe();
    await using (var db = Db()) Check((await Handler(db, notificationProbe, logs).Handle(Command(notify), default)).IsSuccess,
        "post-commit notification failure returns success");
    Check(notificationProbe.Calls == 1 && logs.Errors == 1, "post-commit notification failure logged once");
    await Reject(Command(notify), "retry after notification failure cannot duplicate receive", "COM_409");

    foreach (var conflict in new[] { true, false })
    {
        var f = await Fixture(); var before = await Snapshot(connection);
        await using var db = Db(new FailAfterSave(conflict));
        try
        {
            var result = await Handler(db).Handle(Command(f), default);
            Check(conflict && result.Error?.Code == "COM_409", "post-SQL concurrency fault maps COM_409");
        }
        catch (InvalidOperationException ex) when (!conflict && ex.Message == "B1 controlled failure")
        { Check(true, "unexpected post-SQL fault propagates after rollback"); }
        Check(before == await Snapshot(connection), "post-SQL fault rolls back receipt/stock/occupancy/history/audit");
        Check(!db.ChangeTracker.Entries().Any() && db.Database.CurrentTransaction == null, "post-SQL rollback clears tracker/disposes transaction");
    }
    var stale = await Fixture();
    await using (var db = Db())
    {
        await db.InboundReceipts.Include(x => x.Items).SingleAsync(x => x.Id == stale.Receipt);
        Check((await Receive(stale)).IsSuccess, "independent receive before stale-context replay succeeds");
        var response = await Handler(db).Handle(Command(stale), default);
        Check(response.Error?.Code == "COM_409", "pretracked receipt/details reload prevents stale retry");
    }
    var lockFixture = await Fixture();
    await using (var blocker = Db())
    {
        await using var tx = await new InventoryMutationCoordinator(blocker).BeginAsync(default);
        await new InboundReceiveCoordinator(blocker).LockReceiptAsync(lockFixture.Receipt, default);
        await using var contender = Db(); await contender.Database.OpenConnectionAsync();
        await contender.Database.ExecuteSqlRawAsync("SET LOCK_TIMEOUT 500");
        var result = await Handler(contender).Handle(Command(lockFixture), default);
        Check(result.Error?.Code == "COM_409" && !contender.ChangeTracker.Entries().Any() && contender.Database.CurrentTransaction == null,
            "real SQL lock timeout maps COM_409 with rollback, no HTTP 500");
    }
    if (args.Length == 3) await HttpSmoke(Path.GetFullPath(args[2]));
    else results.Add("NOT TESTED: HTTP smoke (provide absolute API DLL path)");
}
finally
{
    SqlConnection.ClearAllPools();
    if (!database.StartsWith(prefix, StringComparison.Ordinal) || database.Length != prefix.Length + 32)
        throw new Exception("Unexpected cleanup target");
    await using var master = new SqlConnection("Server=(localdb)\\MSSQLLocalDB;Database=master;Integrated Security=true;TrustServerCertificate=true;Encrypt=false");
    await master.OpenAsync(); await using var command = master.CreateCommand();
    command.CommandText = $"IF DB_ID(N'{database}') IS NOT NULL BEGIN ALTER DATABASE [{database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{database}]; END";
    await command.ExecuteNonQueryAsync();
    command.CommandText = $"SELECT COUNT(*) FROM sys.databases WHERE name=N'{database}'";
    Check((int)(await command.ExecuteScalarAsync())! == 0, "isolated B1 fixture database cleanup verified");
    await File.WriteAllLinesAsync(Path.Combine(report, "results.txt"), results);
}
Console.WriteLine($"ALL {results.Count(x => x.StartsWith("PASS:"))} B1 CHECKS PASSED");

async Task HttpSmoke(string apiDll)
{
    var smokeDatabase = prefix + Guid.NewGuid().ToString("N");
    var smokeConnection = new SqlConnectionStringBuilder(connection) { InitialCatalog = smokeDatabase }.ConnectionString;
    try { await HttpSmokeCore(apiDll, smokeConnection); }
    finally
    {
        // HTTP receives use a clean fixture, separate from intentionally invalid/overflow guard fixtures.
        SqlConnection.ClearAllPools();
        if (!smokeDatabase.StartsWith(prefix, StringComparison.Ordinal) || smokeDatabase.Length != prefix.Length + 32)
            throw new Exception("Unexpected HTTP fixture cleanup target");
        await using var master = new SqlConnection("Server=(localdb)\\MSSQLLocalDB;Database=master;Integrated Security=true;TrustServerCertificate=true;Encrypt=false");
        await master.OpenAsync(); await using var command = master.CreateCommand();
        command.CommandText = $"IF DB_ID(N'{smokeDatabase}') IS NOT NULL BEGIN ALTER DATABASE [{smokeDatabase}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{smokeDatabase}]; END";
        await command.ExecuteNonQueryAsync();
        command.CommandText = $"SELECT COUNT(*) FROM sys.databases WHERE name=N'{smokeDatabase}'";
        Check((int)(await command.ExecuteScalarAsync())! == 0, "clean HTTP fixture database cleanup verified");
    }
}

async Task HttpSmokeCore(string apiDll, string smokeConnection)
{
    if (!File.Exists(apiDll)) throw new FileNotFoundException("Build API first", apiDll);
    ApplicationDbContext HttpDb() => new(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(smokeConnection).Options, new VerifyUser());
    var password = Convert.ToHexString(RandomNumberGenerator.GetBytes(16));
    Fixture f;
    await using (var seed = HttpDb())
    {
        await PrepareMigratedFixture(seed);
        var warehouse = new Warehouse { Code = "HTTP-W", Name = "HTTP fixture" };
        var zone = new Zone { Code = "HTTP-Z", Name = "HTTP fixture", Warehouse = warehouse };
        var bin = new Bin { Id = Guid.NewGuid(), Code = "HTTP-B", Zone = zone, MaxCapacity = 100 };
        var product = new Product { SKU = "HTTP-SKU", Barcode = "HTTP-BARCODE", Name = "HTTP fixture", TrackingMode = ProductTrackingMode.Lot };
        var supplier = new Supplier { Code = "HTTP-S", Name = "HTTP fixture" };
        seed.Bins.Add(bin); seed.Products.Add(product); seed.Suppliers.Add(supplier);
        seed.Users.Add(new User { Id = Guid.Parse(VerifyUser.Id), Username = "b1-http", Email = "b1@example.invalid",
            Role = "Admin", IsActive = true, PasswordHash = new PasswordHasher().HashPassword(password) });
        await seed.SaveChangesAsync();
        f = new(Guid.Empty, Guid.Empty, bin.Id, product.Id, zone.Id, warehouse.Id, supplier.Id);
    }
    var listener = new TcpListener(IPAddress.Loopback, 0); listener.Start();
    var port = ((IPEndPoint)listener.LocalEndpoint).Port; listener.Stop();
    var start = new ProcessStartInfo("dotnet") { WorkingDirectory = report, UseShellExecute = false,
        RedirectStandardOutput = true, RedirectStandardError = true, CreateNoWindow = true };
    start.ArgumentList.Add(apiDll); start.ArgumentList.Add("--contentRoot"); start.ArgumentList.Add(Path.GetDirectoryName(apiDll)!);
    start.Environment["ASPNETCORE_ENVIRONMENT"] = "Development";
    start.Environment["ASPNETCORE_URLS"] = $"http://127.0.0.1:{port}";
    start.Environment["ConnectionStrings__DefaultConnection"] = smokeConnection;
    start.Environment["ConnectionStrings__HangfireConnection"] = smokeConnection;
    start.Environment["JwtSettings__Secret"] = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
    start.Environment["JwtSettings__Issuer"] = "SmartWMS.B1.Fixture";
    start.Environment["JwtSettings__Audience"] = "SmartWMS.B1.Fixture";
    foreach (var key in new[] { "DatabaseInitialization__ApplyMigrationsOnStartup", "DatabaseInitialization__SeedOnStartup",
        "Hangfire__EnableServer", "Hangfire__RegisterRecurringJobsOnStartup", "Hangfire__PrepareSchemaIfNecessary" }) start.Environment[key] = "false";
    using var process = Process.Start(start)!;
    var stdout = process.StandardOutput.ReadToEndAsync(); var stderr = process.StandardError.ReadToEndAsync();
    using var http = new HttpClient { BaseAddress = new Uri($"http://127.0.0.1:{port}"), Timeout = TimeSpan.FromSeconds(10) };
    try
    {
        var ready = false;
        for (var i = 0; i < 100 && !process.HasExited; i++)
        {
            try { using var ping = await http.GetAsync("/openapi/v1.json"); ready = ping.IsSuccessStatusCode; if (ready) break; }
            catch (HttpRequestException) { }
            await Task.Delay(200);
        }
        Check(ready, "HTTP fixture API starts with migration/seed/jobs disabled");
        using (var schema = await http.GetAsync("/openapi/v1.json"))
            Check((await schema.Content.ReadAsStringAsync()).Contains("expectedReceivedQuantity"), "OpenAPI exposes receive precondition");
        using var login = await http.PostAsJsonAsync("/api/v1/Auth/login", new { username = "b1-http", password });
        Check(login.StatusCode == HttpStatusCode.OK, "HTTP fixture login succeeds");
        var auth = await login.Content.ReadFromJsonAsync<JsonElement>();
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.GetProperty("data").GetProperty("token").GetString());
        using var created = await http.PostAsJsonAsync("/api/v1/InboundReceipts", new CreateInboundReceiptRequest
        {
            ReceiptNumber = "HTTP-" + Guid.NewGuid().ToString("N"), BinId = f.Bin, SupplierId = f.Supplier,
            ExpectedDeliveryDate = DateTime.UtcNow.Date.AddDays(1),
            Items = [new() { ProductId = f.Product, ExpectedQuantity = 10, LotNumber = "HTTP-LOT", ExpirationDate = expiry }]
        });
        Check(created.StatusCode == HttpStatusCode.OK, "HTTP create receipt succeeds");
        var id = (await created.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data").GetGuid();
        async Task<JsonElement> Read(string route)
        {
            using var response = await http.GetAsync(route); Check(response.StatusCode == HttpStatusCode.OK, "HTTP GET " + route.Split('?')[0]);
            return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data").Clone();
        }
        var receipt = await Read($"/api/v1/InboundReceipts/{id}");
        var itemId = receipt.GetProperty("items")[0].GetProperty("id").GetGuid();
        var partial = new ReceiveInboundReceiptRequest { InboundReceiptId = id,
            ReceivedItems = [new() { ItemId = itemId, QuantityReceived = 4, ExpectedReceivedQuantity = 0 }] };
        using (var response = await http.PostAsJsonAsync("/api/v1/InboundReceipts/confirm-receipt", partial))
            Check(response.StatusCode == HttpStatusCode.OK, "HTTP partial receive succeeds");
        receipt = await Read($"/api/v1/InboundReceipts/{id}");
        Check(receipt.GetProperty("status").GetString() == "Processing" && receipt.GetProperty("items")[0].GetProperty("quantityReceived").GetInt32() == 4,
            "HTTP read confirms partial progress");
        await Read($"/api/v1/Bins/{f.Bin}/contents");
        using (var response = await http.PostAsJsonAsync("/api/v1/InboundReceipts/confirm-receipt", partial))
            Check(response.StatusCode == HttpStatusCode.Conflict, "HTTP partial retry returns 409");
        var final = new ReceiveInboundReceiptRequest { InboundReceiptId = id,
            ReceivedItems = [new() { ItemId = itemId, QuantityReceived = 6, ExpectedReceivedQuantity = 4 }] };
        using (var response = await http.PostAsJsonAsync("/api/v1/InboundReceipts/confirm-receipt", final))
            Check(response.StatusCode == HttpStatusCode.OK, "HTTP final receive succeeds");
        receipt = await Read($"/api/v1/InboundReceipts/{id}");
        Check(receipt.GetProperty("status").GetString() == "Completed", "HTTP receipt Completed");
        await Read("/api/v1/Inventory/stock-summary"); await Read($"/api/v1/Bins/{f.Bin}/contents");
        await Read($"/api/v1/Inventory/stock-history?productId={f.Product}&transactionType=INBOUND");
        var beforeRetry = await Snapshot(smokeConnection);
        using (var response = await http.PostAsJsonAsync("/api/v1/InboundReceipts/confirm-receipt", final))
        {
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            Check(response.StatusCode == HttpStatusCode.Conflict && body.GetProperty("errorCode").GetString() == "COM_409", "HTTP final retry returns COM_409");
        }
        Check(beforeRetry == await Snapshot(smokeConnection), "HTTP retry creates no inventory/occupancy/history/audit mutation");
        await using var db = HttpDb();
        var stock = await db.BinInventories.SingleAsync(x => x.BinId == f.Bin && x.LotNumber == "HTTP-LOT");
        Check(stock.Quantity == 10 && (await db.Bins.FindAsync(f.Bin))!.CurrentOccupancy == 10 &&
            await db.InventoryTransactions.Where(x => x.BinInventoryId == stock.Id).SumAsync(x => x.QuantityChanged) == 10,
            "HTTP stock/occupancy/history equal exactly ten after final retry");
    }
    finally
    {
        if (!process.HasExited) process.Kill(entireProcessTree: true);
        await process.WaitForExitAsync();
        await File.WriteAllTextAsync(Path.Combine(report, "http-host.log"), await stdout + await stderr);
    }
}

static Task PrepareMigratedFixture(ApplicationDbContext db)
{
    return db.Database.MigrateAsync();
}

static async Task<string> Snapshot(string connection)
{
    await using var db = new SqlConnection(connection); await db.OpenAsync(); await using var cmd = db.CreateCommand();
    cmd.CommandText = "SELECT QUOTENAME(SCHEMA_NAME(schema_id))+N'.'+QUOTENAME(name) FROM sys.tables ORDER BY 1";
    var tables = new List<string>(); await using (var r = await cmd.ExecuteReaderAsync()) while (await r.ReadAsync()) tables.Add(r.GetString(0));
    var data = new List<string>();
    foreach (var table in tables)
    {
        cmd.CommandText = $"SELECT * FROM {table}"; var rows = new List<string>();
        await using var r = await cmd.ExecuteReaderAsync();
        while (await r.ReadAsync()) { var values = new object[r.FieldCount]; r.GetValues(values);
            rows.Add(JsonSerializer.Serialize(values.Select(x => x is DBNull ? null : x is byte[] b ? Convert.ToHexString(b) : x))); }
        rows.Sort(StringComparer.Ordinal); data.Add(table + ":" + string.Join("\n", rows));
    }
    return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(string.Join("\n", data))));
}
record Fixture(Guid Receipt, Guid Item, Guid Bin, Guid Product, Guid Zone, Guid Warehouse, Guid Supplier);
sealed class VerifyUser : ICurrentUserService
{
    public const string Id = "b1111111-1111-1111-1111-111111111111";
    public string UserId => Id;
    public string Role => "Admin";
    public string IpAddress => "127.0.0.1";
}
sealed class NotificationProbe : IInventoryNotificationService
{
    public bool Fail; public int Calls;
    public Task SendToGroupAsync(string groupName, string method, object data) => Task.CompletedTask;
    public Task SendInventoryUpdateAsync(InventoryUpdateModel model) { Calls++; return Fail ? Task.FromException(new InvalidOperationException("notification unavailable")) : Task.CompletedTask; }
}
sealed class LogProbe : ILogger<ReceiveInboundReceiptCommandHandler>
{
    public int Errors;
    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
    public bool IsEnabled(LogLevel level) => true;
    public void Log<TState>(LogLevel level, EventId id, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
    { if (level == LogLevel.Error) Errors++; }
}
sealed class FailAfterSave(bool conflict) : SaveChangesInterceptor
{
    public override ValueTask<int> SavedChangesAsync(SaveChangesCompletedEventData eventData, int result, CancellationToken cancellationToken = default) =>
        throw (conflict ? new DbUpdateConcurrencyException("B1 controlled concurrency") : new InvalidOperationException("B1 controlled failure"));
}
