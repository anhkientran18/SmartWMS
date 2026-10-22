using System.Data.Common;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Microsoft.EntityFrameworkCore.Storage;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.CycleCounting.Commands.CreateCountSheet;
using SmartWMS.Application.Features.CycleCounting.Commands.ConfirmCycleCount;
using SmartWMS.Application.Features.CycleCounting.Commands.ScheduleAutoCycleCount;
using SmartWMS.Application.Features.CycleCounting.DTOs.Commands;
using SmartWMS.Application.Features.CycleCounting.Queries.GetPendingCountTasks;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums;
using SmartWMS.Infrastructure.Persistence.DbContext;
using SmartWMS.Infrastructure.Services;

if (args.Length != 2 || args[0] != "--verify-localdb") throw new ArgumentException("Usage: --verify-localdb <report-directory>");
var report = Path.GetFullPath(args[1]); Directory.CreateDirectory(report);
const string business = "Server=(localdb)\\MSSQLLocalDB;Database=SmartWMS_DB;Integrated Security=true;TrustServerCertificate=true;Encrypt=false";
var database = "SmartWMS_Phase4B_Verify_" + Guid.NewGuid().ToString("N");
var fixtureConnection = new SqlConnectionStringBuilder(business) { InitialCatalog = database }.ConnectionString;
var userId = Guid.NewGuid();
var results = new List<string>();
void Check(bool condition, string label) { if (!condition) throw new Exception("FAIL: " + label); results.Add("PASS: " + label); Console.WriteLine(results[^1]); }
ApplicationDbContext Db(params IInterceptor[] interceptors) => new(new DbContextOptionsBuilder<ApplicationDbContext>()
    .UseSqlServer(fixtureConnection).AddInterceptors(interceptors).Options, new VerifyUser(userId));
var before = await Snapshot(business);
await File.WriteAllTextAsync(Path.Combine(report, "before.json"), JsonSerializer.Serialize(before));
try
{
    await using (var db = Db())
    {
        Check(!db.Database.HasPendingModelChanges(), "EF model matches migration snapshot");
        var migrations = db.GetService<IMigrationsAssembly>();
        var migration = migrations.CreateMigration(migrations.Migrations["20261021130000_AddCycleCountSnapshotEvidence"], db.Database.ProviderName!);
        Check(migration.UpOperations.Count == 2 && migration.UpOperations.All(x => x is AddColumnOperation a && a.Table == "CycleCountItems" && a.IsNullable && a.DefaultValue == null && a.DefaultValueSql == null) &&
            migration.UpOperations.Cast<AddColumnOperation>().Select(x => x.Name).Order().SequenceEqual(new[] { "SnapshotBinInventoryId", "SnapshotRowVersion" }), "migration only adds two nullable snapshot fields; no backfill");
        // Historical migrations contain environment-specific legacy-data guards. Bootstrap a blank
        // fixture from the preceding migration's model, not from business data; test only the new migration.
        var previous = migrations.CreateMigration(migrations.Migrations["20261020021119_AddOutboundReservationTaskWaveWorkflow"], db.Database.ProviderName!);
        var previousModel = db.GetService<IModelRuntimeInitializer>().Initialize(previous.TargetModel, designTime: true);
        var schemaOperations = db.GetService<IMigrationsModelDiffer>().GetDifferences(null, previousModel.GetRelationalModel())
            .Where(x => x is not InsertDataOperation).ToList();
        await db.GetService<IRelationalDatabaseCreator>().CreateAsync();
        foreach (var sql in db.GetService<IMigrationsSqlGenerator>().Generate(schemaOperations, previousModel))
            await db.Database.ExecuteSqlRawAsync(sql.CommandText);
        var history = db.GetService<IHistoryRepository>();
        await db.Database.ExecuteSqlRawAsync(history.GetCreateScript());
        foreach (var name in migrations.Migrations.Keys.Where(x => string.CompareOrdinal(x, "20261021130000_AddCycleCountSnapshotEvidence") < 0))
            await db.Database.ExecuteSqlRawAsync(history.GetInsertScript(new HistoryRow(name, "10.0.8")));
        Check(true, "blank fixture baseline built from prior migration model; no legacy data copied");
        var schemaBefore = await Schema(fixtureConnection);
        await db.Database.MigrateAsync();
        var schemaAfter = await Schema(fixtureConnection);
        var additions = schemaAfter.Except(schemaBefore).ToArray();
        Check(!schemaBefore.Except(schemaAfter).Any() && additions.Length == 2 && additions.Any(x => x.Contains("SnapshotBinInventoryId|uniqueidentifier|16|True")) &&
            additions.Any(x => x.Contains("SnapshotRowVersion|binary|8|True")), "actual fixture schema diff exactly two nullable columns; indexes/FKs/checks unchanged");
        Check(!(await db.Database.GetPendingMigrationsAsync()).Any(), "fixture pending migrations = 0");
        db.Users.Add(new User { Id = userId, Username = userId.ToString(), Email = "fixture@example.invalid", Role = "Staff" });
        await db.SaveChangesAsync();
    }
    Console.WriteLine("Fixture database: " + database);
    async Task<StockFixture> Fixture(int quantity = 10, int rows = 1)
    {
        await using var db = Db();
        var tag = Guid.NewGuid().ToString("N");
        var warehouse = new Warehouse { Code = tag, Name = tag };
        var zone = new Zone { Code = tag, Name = tag, Warehouse = warehouse };
        var bin = new Bin { Code = tag, Zone = zone, MaxCapacity = 100, CurrentOccupancy = (long)quantity * rows };
        var ids = new List<Guid>();
        for (var i = 0; i < rows; i++)
        {
            var product = new Product { SKU = tag + i, Barcode = tag + i, Name = tag, TrackingMode = ProductTrackingMode.None };
            var stock = new BinInventory { Bin = bin, Product = product, LotNumber = "LOT-DEFAULT", Quantity = quantity, Status = InventoryStatus.Available };
            db.BinInventories.Add(stock); ids.Add(stock.Id);
        }
        await db.SaveChangesAsync();
        return new(bin.Id, zone.Id, ids);
    }
    async Task Change(Action<ApplicationDbContext> action) { await using var db = Db(); action(db); await db.SaveChangesAsync(); }
    async Task<Result<Guid>> Create(StockFixture f, ApplicationDbContext? supplied = null)
    {
        var db = supplied ?? Db();
        try { return await new CreateCountSheetCommandHandler(db, new InventoryMutationCoordinator(db), new CycleCountCoordinator(db)).Handle(
            new(new CreateCountSheetRequest { BinId = f.Bin, ZoneId = f.Zone, AssignedUserId = userId }), default); }
        finally { if (supplied == null) await db.DisposeAsync(); }
    }
    async Task<CycleCountSheet> Sheet(Guid id) { await using var db = Db(); return await db.CycleCountSheets.AsNoTracking().Include(x => x.Items).SingleAsync(x => x.Id == id); }
    async Task<ConfirmCycleCountRequest> Request(Guid id, int value = 10) => new() { CountSheetId = id,
        CountedItems = (await Sheet(id)).Items.Select(x => new CycleCountItemRequest { ItemId = x.Id, CountedQuantity = value }).ToList() };
    async Task<Result<bool>> Confirm(ConfirmCycleCountRequest request, ApplicationDbContext? supplied = null)
    {
        var db = supplied ?? Db();
        try { return await new ConfirmCycleCountCommandHandler(db, new InventoryMutationCoordinator(db), new CycleCountCoordinator(db)).Handle(new(request), default); }
        finally { if (supplied == null) await db.DisposeAsync(); }
    }
    async Task RejectUnchanged(ConfirmCycleCountRequest request, string label, bool conflict = false)
    {
        var beforeReject = await Snapshot(fixtureConnection);
        await using var db = Db();
        var result = await Confirm(request, db);
        Check(!result.IsSuccess && (!conflict || result.Error?.Code == "COM_409"), label);
        Check(!db.ChangeTracker.Entries().Any() && db.Database.CurrentTransaction == null, label + ": tracker cleared/transaction disposed");
        var afterReject = await Snapshot(fixtureConnection);
        Check(beforeReject.SequenceEqual(afterReject), label + ": no stock/sheet/occupancy/ledger/audit mutation");
    }
    var normal = await Fixture(rows: 2);
    var created = await Create(normal); Check(created.IsSuccess, "create sheet succeeds");
    var snapshot = await Sheet(created.Data);
    await using (var db = Db())
    {
        var stocks = await db.BinInventories.Where(x => x.BinId == normal.Bin).ToListAsync();
        Check(snapshot.Items.Count == 2 && snapshot.Items.All(i => stocks.Any(s => s.Id == i.SnapshotBinInventoryId &&
            s.RowVersion.SequenceEqual(i.SnapshotRowVersion!) && s.Quantity == i.SystemQuantity && s.BinId == i.BinId && s.ProductId == i.ProductId)), "create stores exact stock identity/version/quantity");
    }
    var partial = await Request(snapshot.Id); partial.CountedItems.RemoveAt(0); await RejectUnchanged(partial, "partial confirm rejects");
    var duplicate = await Request(snapshot.Id); duplicate.CountedItems.Add(duplicate.CountedItems[0]); await RejectUnchanged(duplicate, "duplicate confirm rejects");
    var foreign = await Request(snapshot.Id); foreign.CountedItems[0].ItemId = Guid.NewGuid(); await RejectUnchanged(foreign, "out-of-sheet item rejects");
    var negative = await Request(snapshot.Id); negative.CountedItems[0].CountedQuantity = -1; await RejectUnchanged(negative, "negative count rejects");
    var correction = await Request(snapshot.Id, 12);
    Check((await Confirm(correction)).IsSuccess, "all-item correction succeeds");
    await using (var db = Db())
    {
        Check((await Sheet(snapshot.Id)).Status == "Completed" && await db.BinInventories.Where(x => x.BinId == normal.Bin).AllAsync(x => x.Quantity == 12), "Completed and corrected quantities commit together");
        Check((await db.Bins.SingleAsync(x => x.Id == normal.Bin)).CurrentOccupancy == 24, "aggregate occupancy correction correct");
        var ledger = await db.InventoryTransactions.Where(x => x.ReasonCode == "CYCLE_COUNT_" + snapshot.Id.ToString("N")).ToListAsync();
        Check(ledger.Count == 2 && ledger.All(x => x.QuantityChanged == 2 && normal.Stocks.Contains(x.BinInventoryId!.Value) && x.CreatedBy == userId.ToString()), "ledger references correct inventory and authenticated actor");
        Check(await db.AuditLogs.AnyAsync(x => x.TableName == "CycleCountSheets" && x.Type == "U" && x.UserId == userId.ToString()), "sheet audit committed with correction");
    }
    await RejectUnchanged(correction, "completed sheet rejects replay", true);
    foreach (var legacyKind in new[] { "id", "version", "duplicate" })
    {
        var f = await Fixture(rows: 2); var id = (await Create(f)).Data;
        await Change(db => { var items = db.CycleCountItems.Where(x => x.CountSheetId == id).OrderBy(x => x.Id).ToList();
            if (legacyKind == "id") items[0].SnapshotBinInventoryId = null;
            else if (legacyKind == "version") items[0].SnapshotRowVersion = null;
            else items[1].SnapshotBinInventoryId = items[0].SnapshotBinInventoryId; });
        await RejectUnchanged(await Request(id), "legacy/invalid snapshot " + legacyKind + " rejects", true);
    }
    foreach (var staleKind in new[] { "version", "identity" })
    {
        var f = await Fixture(); var id = (await Create(f)).Data;
        await Change(db => { var stock = db.BinInventories.Single(x => x.Id == f.Stocks[0]);
            if (staleKind == "version") stock.ExpirationDate = DateTime.UtcNow.AddDays(30);
            else { db.BinInventories.Remove(stock); db.BinInventories.Add(new BinInventory { BinId = stock.BinId, ProductId = stock.ProductId, LotNumber = stock.LotNumber, Quantity = stock.Quantity, Status = stock.Status }); } });
        await RejectUnchanged(await Request(id), "stale " + staleKind + " rejects with COM_409", true);
    }
    foreach (var variance in new[] { 0, 1 })
    {
        var f = await Fixture(); var id = (await Create(f)).Data; var req = await Request(id, 10 + variance);
        var responses = await Task.WhenAll(Confirm(req), Confirm(req));
        Check(responses.Count(x => x.IsSuccess) == 1 && responses.Count(x => x.Error?.Code == "COM_409") == 1, $"double submit variance={variance}: exactly one winner");
        await using var db = Db();
        Check(await db.InventoryTransactions.CountAsync(x => x.ReasonCode == "CYCLE_COUNT_" + id.ToString("N")) == (variance == 0 ? 0 : 1), $"double submit variance={variance}: ledger exactly once or absent");
    }
    var tracked = await Fixture(); var trackedId = (await Create(tracked)).Data;
    await using (var staleContext = Db())
    {
        await staleContext.BinInventories.Where(x => x.Id == tracked.Stocks[0]).LoadAsync();
        await staleContext.CycleCountSheets.Include(x => x.Items).Where(x => x.Id == trackedId).LoadAsync();
        await Change(db => db.BinInventories.Single(x => x.Id == tracked.Stocks[0]).ExpirationDate = DateTime.UtcNow.AddDays(10));
        var result = await Confirm(await Request(trackedId), staleContext);
        Check(result.Error?.Code == "COM_409" && !staleContext.ChangeTracker.Entries().Any(), "pretracked old stock cannot bypass snapshot check on zero variance");
    }
    var trackedSheet = await Fixture(); var trackedSheetId = (await Create(trackedSheet)).Data;
    await using (var staleContext = Db())
    {
        await staleContext.CycleCountSheets.Include(x => x.Items).Where(x => x.Id == trackedSheetId).LoadAsync();
        var req = await Request(trackedSheetId);
        Check((await Confirm(req)).IsSuccess, "first confirm before pretracked replay succeeds");
        Check((await Confirm(req, staleContext)).Error?.Code == "COM_409", "pretracked Pending sheet reloads Completed and rejects replay");
    }
    var atomic = await Fixture(); var createPause = new PauseBeforeSave();
    await using (var handlerDb = Db(createPause))
    {
        var createTask = Create(atomic, handlerDb);
        await createPause.Entered.Task.WaitAsync(TimeSpan.FromSeconds(15));
        try
        {
            await using var writer = Db(); await writer.Database.OpenConnectionAsync(); await writer.Database.ExecuteSqlRawAsync("SET LOCK_TIMEOUT 500");
            try { await writer.Database.ExecuteSqlInterpolatedAsync($"UPDATE [BinInventories] SET [Quantity] = [Quantity] + 1 WHERE [Id] = {atomic.Stocks[0]}"); throw new Exception("snapshot not atomic"); }
            catch (SqlException ex) when (ex.Number == 1222) { Check(true, "create retains inventory version locks through sheet persistence"); }
        }
        finally { createPause.Release.TrySetResult(); }
        Check((await createTask).IsSuccess, "atomic snapshot create commits after lock contender");
    }
    async Task Workflow(StockFixture f)
    {
        await using var db = Db(); var stock = await db.BinInventories.SingleAsync(x => x.Id == f.Stocks[0]);
        var order = new OutboundIssue { OrderNumber = Guid.NewGuid().ToString("N"), BinId = f.Bin };
        order.Items.Add(new OutboundOrderItem { ProductId = stock.ProductId, Quantity = 1 });
        var staging = new Bin { Code = Guid.NewGuid().ToString("N"), ZoneId = f.Zone, MaxCapacity = 100 };
        db.Bins.Add(staging);
        db.OutboundAllocations.Add(new OutboundAllocation { Order = order, Generation = 1, SourceBinId = f.Bin, StagingBin = staging });
        await db.SaveChangesAsync();
    }
    foreach (var kind in new[] { "reserved", "workflow", "serial", "serial-link", "lpn", "hierarchy", "ambiguous" })
    {
        var f = await Fixture(); var id = (await Create(f)).Data;
        if (kind == "workflow") await Workflow(f);
        else await Change(db => { var stock = db.BinInventories.Include(x => x.Product).Single(x => x.Id == f.Stocks[0]);
            switch (kind)
            {
                case "reserved": stock.ReservedQuantity = 1; break;
                case "serial": stock.Product.TrackingMode = ProductTrackingMode.Serial; break;
                case "serial-link": db.ProductSerialNumbers.Add(new ProductSerialNumber { Id = Guid.NewGuid(), ProductId = stock.ProductId, BinInventoryId = stock.Id, SerialCode = Guid.NewGuid().ToString("N") }); break;
                case "lpn": stock.LpnCode = "FIXTURE-LPN"; break;
                case "hierarchy": db.Zones.Single(x => x.Id == f.Zone).IsDeleted = true; break;
                case "ambiguous": db.BinInventories.Add(new BinInventory { BinId = f.Bin, ProductId = stock.ProductId, LotNumber = stock.LotNumber, Status = InventoryStatus.Damaged }); break;
            }
        });
        var beforeCreate = await Snapshot(fixtureConnection);
        Check(!(await Create(f)).IsSuccess, "create rejects " + kind);
        Check(beforeCreate.SequenceEqual(await Snapshot(fixtureConnection)), "create reject " + kind + " has no writes");
        await RejectUnchanged(await Request(id), "confirm rejects " + kind);
    }
    var collation = await Fixture();
    await Change(db => { var stock = db.BinInventories.Single(x => x.Id == collation.Stocks[0]);
        db.BinInventories.Add(new BinInventory { BinId = stock.BinId, ProductId = stock.ProductId,
            LotNumber = "lot-default", Status = InventoryStatus.Damaged }); });
    Check((await Create(collation)).Error?.Code == "COM_409", "create rejects lot identity ambiguity under SQL collation");
    foreach (var count in new[] { 0, 100, 101 })
    {
        var f = await Fixture(); var id = (await Create(f)).Data;
        if (count == 101) await RejectUnchanged(await Request(id, count), "capacity overflow rejects");
        else Check((await Confirm(await Request(id, count))).IsSuccess, "occupancy boundary " + count + " passes");
    }
    var underflow = await Fixture(); var underId = (await Create(underflow)).Data;
    await Change(db => db.Bins.Single(x => x.Id == underflow.Bin).CurrentOccupancy = 0);
    await RejectUnchanged(await Request(underId, 0), "negative occupancy rejects");
    var wide = await Fixture(1, 2); await Change(db => db.Bins.Single(x => x.Id == wide.Bin).MaxCapacity = 2L * int.MaxValue);
    var wideId = (await Create(wide)).Data;
    Check((await Confirm(await Request(wideId, int.MaxValue))).IsSuccess, "aggregate arithmetic exceeds int.MaxValue safely");
    await using (var db = Db()) Check((await db.Bins.SingleAsync(x => x.Id == wide.Bin)).CurrentOccupancy == 2L * int.MaxValue, "wide occupancy exact");

    // Real SQL lock timeout while the production handler holds a sheet transaction.
    var timeout = await Fixture(); var timeoutId = (await Create(timeout)).Data;
    await using (var blocker = Db())
    await using (var contender = Db())
    {
        var mutations = new InventoryMutationCoordinator(blocker); await using var tx = await mutations.BeginAsync(default);
        await new CycleCountCoordinator(blocker).LockSheetAsync(timeoutId, default);
        await contender.Database.OpenConnectionAsync(); await contender.Database.ExecuteSqlRawAsync("SET LOCK_TIMEOUT 500");
        var result = await Confirm(await Request(timeoutId), contender);
        Check(result.Error?.Code == "COM_409" && !contender.ChangeTracker.Entries().Any() && contender.Database.CurrentTransaction == null, "real SQL 1222 maps COM_409; rollback clears tracker/transaction");
        await tx.RollbackAsync();
        Check(await contender.Database.SqlQuery<int>($"SELECT 1 AS [Value]").SingleAsync() == 1, "context/connection usable after conflict");
    }
    // Inject a concurrency exception after writes reached SQL but before the outer transaction commits.
    var rollback = await Fixture(rows: 2); var rollbackId = (await Create(rollback)).Data;
    var rollbackBefore = await Snapshot(fixtureConnection);
    await using (var db = Db(new FailAfterSave()))
    {
        var response = await Confirm(await Request(rollbackId, 11), db);
        Check(response.Error?.Code == "COM_409" && !db.ChangeTracker.Entries().Any(), "post-save fault rolls back and clears tracked audit/mutations");
        Check(rollbackBefore.SequenceEqual(await Snapshot(fixtureConnection)), "post-save rollback: no partial stock/occupancy/ledger/audit/Completed");
    }
    // Pause the handler after stock locks/validation but before SaveChanges: even variance=0 retains its locks.
    var guarded = await Fixture(); var guardedId = (await Create(guarded)).Data; var pause = new PauseBeforeSave();
    await using (var handlerDb = Db(pause))
    {
        var confirmTask = Confirm(await Request(guardedId), handlerDb);
        await pause.Entered.Task.WaitAsync(TimeSpan.FromSeconds(15));
        try
        {
            await using var writer = Db(); await writer.Database.OpenConnectionAsync(); await writer.Database.ExecuteSqlRawAsync("SET LOCK_TIMEOUT 500");
            try { await writer.Database.ExecuteSqlInterpolatedAsync($"UPDATE [BinInventories] SET [Quantity] = [Quantity] + 1 WHERE [Id] = {guarded.Stocks[0]}"); throw new Exception("unguarded zero-variance confirmation"); }
            catch (SqlException ex) when (ex.Number == 1222) { Check(true, "variance=0 confirm blocks concurrent stock mutation until commit"); }
        }
        finally { pause.Release.TrySetResult(); }
        Check((await confirmTask).IsSuccess, "variance=0 guarded confirm completes");
    }
    var otherUser = Guid.NewGuid();
    await Change(db => db.Users.Add(new User { Id = otherUser, Username = otherUser.ToString(), Email = "other@example.invalid" }));
    var otherFixture = await Fixture(); var otherId = (await Create(otherFixture)).Data;
    await Change(db => db.CycleCountSheets.Single(x => x.Id == otherId).AssignedUserId = otherUser);
    await using (var db = Db())
    {
        var tasks = await new GetPendingCountTasksQueryHandler(db, new VerifyUser(userId)).Handle(new() { OperatorName = otherUser.ToString() }, default);
        var own = await db.CycleCountSheets.Where(x => x.AssignedUserId == userId).Select(x => x.Id).ToListAsync();
        Check(tasks.IsSuccess && tasks.Data!.Count > 0 && tasks.Data.All(x => own.Contains(x.CountSheetId)) && !tasks.Data.Any(x => x.CountSheetId == otherId), "pending tasks filter authenticated assignment; spoofed operator ignored");
    }
    var scheduled = await new ScheduleAutoCycleCountCommandHandler().Handle(new(new ScheduleAutoCycleCountRequest { ZoneId = normal.Zone, CronExpression = "0 0 * * *" }), default);
    Check(!scheduled.IsSuccess && scheduled.Error!.Message.Contains("UNSUPPORTED"), "schedule explicitly rejects unsupported");
}
finally
{
    SqlConnection.ClearAllPools();
    if (!database.StartsWith("SmartWMS_Phase4B_Verify_", StringComparison.Ordinal) || database.Length != 56) throw new Exception("Unexpected cleanup target");
    await using var master = new SqlConnection(new SqlConnectionStringBuilder(business) { InitialCatalog = "master" }.ConnectionString);
    await master.OpenAsync(); await using var command = master.CreateCommand();
    command.CommandText = $"IF DB_ID(N'{database}') IS NOT NULL BEGIN ALTER DATABASE [{database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{database}]; END";
    await command.ExecuteNonQueryAsync();
    command.CommandText = $"SELECT COUNT(*) FROM sys.databases WHERE name = N'{database}'";
    Check((int)(await command.ExecuteScalarAsync())! == 0, "fixture DB cleanup verified");
    var after = await Snapshot(business);
    await File.WriteAllTextAsync(Path.Combine(report, "after.json"), JsonSerializer.Serialize(after));
    Check(before.SequenceEqual(after), "business/workflow/Hangfire/schema snapshots unchanged");
    await File.WriteAllLinesAsync(Path.Combine(report, "results.txt"), results);
}
Console.WriteLine($"ALL {results.Count} CHECKS PASSED");

static async Task<HashSet<string>> Schema(string connectionString)
{
    await using var c = new SqlConnection(connectionString); await c.OpenAsync(); await using var cmd = c.CreateCommand();
    cmd.CommandText = "SELECT t.name + '|' + c.name, TYPE_NAME(c.user_type_id), c.max_length, c.is_nullable FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id ORDER BY 1";
    var rows = new HashSet<string>();
    await using (var r = await cmd.ExecuteReaderAsync()) while (await r.ReadAsync()) rows.Add($"{r.GetString(0)}|{r.GetString(1)}|{r.GetInt16(2)}|{r.GetBoolean(3)}");
    cmd.CommandText = "SELECT (SELECT * FROM sys.indexes ORDER BY object_id,index_id FOR JSON PATH) + (SELECT * FROM sys.foreign_keys ORDER BY object_id FOR JSON PATH) + (SELECT * FROM sys.check_constraints ORDER BY object_id FOR JSON PATH)";
    rows.Add((string)(await cmd.ExecuteScalarAsync())!); return rows;
}
static async Task<SortedDictionary<string, string>> Snapshot(string connectionString)
{
    await using var connection = new SqlConnection(connectionString); await connection.OpenAsync();
    var result = new SortedDictionary<string, string>();
    var tables = new List<(string Schema, string Name)>();
    await using (var cmd = connection.CreateCommand())
    {
        cmd.CommandText = "SELECT SCHEMA_NAME(schema_id),name FROM sys.tables ORDER BY 1,2";
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync()) tables.Add((reader.GetString(0), reader.GetString(1)));
    }
    static string Hash(string s) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(s)));
    foreach (var (schema, name) in tables)
    {
        await using var cmd = connection.CreateCommand();
        cmd.CommandText = $"SELECT * FROM [{schema.Replace("]", "]]")}].[{name.Replace("]", "]]")}]";
        await using var reader = await cmd.ExecuteReaderAsync();
        var rows = new List<string>();
        while (await reader.ReadAsync())
        {
            var values = new object[reader.FieldCount]; reader.GetValues(values);
            rows.Add(Hash(JsonSerializer.Serialize(values.Select(v => v is DBNull ? null : v is byte[] b ? Convert.ToHexString(b) : v))));
        }
        rows.Sort(StringComparer.Ordinal); result[schema + "." + name] = rows.Count + ":" + Hash(string.Join("\n", rows));
    }
    await using (var cmd = connection.CreateCommand())
    {
        cmd.CommandText = "SELECT (SELECT * FROM sys.columns ORDER BY object_id,column_id FOR JSON PATH) + (SELECT * FROM sys.indexes ORDER BY object_id,index_id FOR JSON PATH) + (SELECT * FROM sys.foreign_keys ORDER BY object_id FOR JSON PATH) + (SELECT * FROM sys.check_constraints ORDER BY object_id FOR JSON PATH)";
        result["$schema"] = Hash((string)(await cmd.ExecuteScalarAsync())!);
    }
    return result;
}

record StockFixture(Guid Bin, Guid Zone, List<Guid> Stocks);
sealed class VerifyUser(Guid id) : ICurrentUserService { public string UserId => id.ToString(); public string Role => "Staff"; public string IpAddress => "127.0.0.1"; }
sealed class FailAfterSave : SaveChangesInterceptor
{
    public override ValueTask<int> SavedChangesAsync(SaveChangesCompletedEventData eventData, int result, CancellationToken cancellationToken = default) =>
        throw new DbUpdateConcurrencyException("Controlled fixture fault after SQL writes");
}
sealed class PauseBeforeSave : SaveChangesInterceptor
{
    public TaskCompletionSource Entered { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
    public TaskCompletionSource Release { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
    public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        Entered.TrySetResult(); await Release.Task.WaitAsync(TimeSpan.FromSeconds(20), cancellationToken); return result;
    }
}
