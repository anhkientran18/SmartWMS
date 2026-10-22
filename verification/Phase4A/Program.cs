using System.Data;
using System.Data.Common;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using MediatR;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InventoryTransfers.Commands.CreateInventoryTransfer;
using SmartWMS.Application.Features.InventoryTransfers.DTOs.Commands;
using SmartWMS.Application.Features.InventoryManagement.Commands.AdjustStock;
using SmartWMS.Application.Features.InventoryManagement.Commands.ChangeStockStatus;
using SmartWMS.Application.Features.InventoryManagement.Commands.LockExpiredStock;
using SmartWMS.Application.Features.InventoryManagement.DTOs.Commands;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums;
using SmartWMS.Infrastructure.Persistence.DbContext;
using SmartWMS.Infrastructure.Services;

// Explicit opt-in; never run the global expiry flows against the business database.
if (args.Length != 2 || args[0] != "--verify-localdb" )
    throw new ArgumentException("Usage: --verify-localdb <report-directory>");
var report = Path.GetFullPath(args[1]);
Directory.CreateDirectory(report);
var production = "Server=(localdb)\\MSSQLLocalDB;Database=SmartWMS_DB;Integrated Security=true;TrustServerCertificate=true;Encrypt=false";
var database = "SmartWMS_Phase4A_Verify_" + Guid.NewGuid().ToString("N");
var testConnection = new SqlConnectionStringBuilder(production) { InitialCatalog = database }.ConnectionString;
var results = new List<string>();
void Check(bool ok, string label) { if (!ok) throw new Exception("FAIL: " + label); results.Add("PASS: " + label); Console.WriteLine(results[^1]); }
ApplicationDbContext Db(bool test = true, params IInterceptor[] interceptors) => new(
    new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(test ? testConnection : production)
        .AddInterceptors(interceptors).Options, new VerificationUser());

var before = await Snapshot(production);
await File.WriteAllTextAsync(Path.Combine(report, "before.json"), JsonSerializer.Serialize(before, new JsonSerializerOptions { WriteIndented = true }));
await using (var db = Db(false))
{
    Check(!(await db.Database.GetPendingMigrationsAsync()).Any(), "business database pending migrations = 0");
    Check(!db.Database.HasPendingModelChanges(), "EF model matches migration snapshot");
}
try
{
    await using (var db = Db()) await db.Database.EnsureCreatedAsync();
    Console.WriteLine("Isolated fixture database: " + database);
    async Task<Fixture> Fixture(int quantity = 10, int reserved = 4, ProductTrackingMode mode = ProductTrackingMode.None,
        int expiryDays = 90, InventoryStatus status = InventoryStatus.Available, bool sourceFirst = false)
    {
        await using var db = Db();
        var tag = Guid.NewGuid().ToString("N");
        var warehouse = new Warehouse { Id = Guid.NewGuid(), Code = tag, Name = tag };
        var zone = new Zone { Id = Guid.NewGuid(), Code = tag, Name = tag, Warehouse = warehouse };
        var sourceId = Guid.NewGuid(); var destinationId = Guid.NewGuid();
        if (sourceFirst && sourceId.CompareTo(destinationId) > 0)
            (sourceId, destinationId) = (destinationId, sourceId);
        var source = new Bin { Id = sourceId, Code = "S" + tag, Zone = zone, MaxCapacity = int.MaxValue, CurrentOccupancy = quantity };
        var destination = new Bin { Id = destinationId, Code = "D" + tag, Zone = zone, MaxCapacity = int.MaxValue };
        var product = new Product { Id = Guid.NewGuid(), SKU = tag, Barcode = tag, Name = tag, TrackingMode = mode };
        var stock = new BinInventory { Id = Guid.NewGuid(), Bin = source, Product = product, LotNumber = "LOT-DEFAULT",
            Quantity = quantity, ReservedQuantity = reserved, Status = status, ExpirationDate = DateTime.UtcNow.AddDays(expiryDays) };
        db.Bins.Add(destination); db.BinInventories.Add(stock);
        await db.SaveChangesAsync();
        return new(stock.Id, source.Id, destination.Id, product.Id, zone.Id);
    }
    async Task<Result<Guid>> Transfer(Fixture f, int quantity, ApplicationDbContext? supplied = null)
    {
        var db = supplied ?? Db();
        try { return await new CreateInventoryTransferCommandHandler(db, new InventoryMutationCoordinator(db)).Handle(
            new(new CreateInventoryTransferRequest { SourceBinId = f.Source, DestinationBinId = f.Destination,
                ProductId = f.Product, TransferQuantity = quantity, Reason = "Phase4A verification" }), default); }
        finally { if (supplied == null) await db.DisposeAsync(); }
    }
    async Task<Result<bool>> Adjust(Fixture f, int delta, ApplicationDbContext? supplied = null)
    {
        var db = supplied ?? Db();
        try { return await new AdjustStockCommandHandler(db, new InventoryMutationCoordinator(db)).Handle(
            new(new AdjustStockRequest { BinId = f.Source, ProductId = f.Product, AdjustmentQuantity = delta, ReasonCode = "Phase4A verification" }), default); }
        finally { if (supplied == null) await db.DisposeAsync(); }
    }
    async Task<Result<bool>> Status(Fixture f, InventoryStatus status, bool failNotification = false)
    {
        await using var db = Db();
        var mediator = DispatchProxy.Create<IMediator, NotificationProbe>();
        ((NotificationProbe)(object)mediator).Fail = failNotification;
        return await new ChangeStockStatusCommandHandler(db, new InventoryMutationCoordinator(db), mediator, new ProbeLogger<ChangeStockStatusCommandHandler>())
            .Handle(new(new ChangeStockStatusRequest { BinId = f.Source, ProductId = f.Product, NewStatus = status, ReasonCode = "Phase4A verification" }), default);
    }
    async Task<BinInventory> Stock(Fixture f) { await using var db = Db(); return await db.BinInventories.AsNoTracking().SingleAsync(x => x.Id == f.Stock); }
    async Task<long> Ledger() { await using var db = Db(); return await db.InventoryTransactions.LongCountAsync(); }
    async Task Change(Action<ApplicationDbContext> action) { await using var db = Db(); action(db); await db.SaveChangesAsync(); }
    async Task DuplicateStatus(Fixture f, InventoryStatus status)
    {
        await Change(db => db.BinInventories.Add(new BinInventory { Id = Guid.NewGuid(), BinId = f.Source,
            ProductId = f.Product, LotNumber = "LOT-DEFAULT", Quantity = 1, Status = status }));
    }
    var boundary = await Fixture();
    Check(!(await Transfer(boundary, 7)).IsSuccess, "transfer requested > Available rejects");
    Check((await Stock(boundary)).Quantity == 10, "rejected transfer preserves source");
    Check((await Transfer(boundary, 6)).IsSuccess, "transfer requested == Available passes");
    var remaining = await Stock(boundary);
    Check(remaining.Quantity == 4 && remaining.ReservedQuantity == 4, "transfer leaves Quantity == ReservedQuantity and reservation unchanged");
    await using (var db = Db())
        Check(await db.BinInventories.AnyAsync(x => x.BinId == boundary.Destination && x.Quantity == 6 && x.ReservedQuantity == 0), "transfer does not move reservation");
    Check(!(await Transfer(boundary, 1)).IsSuccess, "transfer rejects when Quantity == ReservedQuantity");
    var adjustment = await Fixture();
    Check((await Adjust(adjustment, -6)).IsSuccess, "adjustment result == ReservedQuantity passes");
    Check(!(await Adjust(adjustment, -1)).IsSuccess, "adjustment result < ReservedQuantity rejects");
    Check((await Stock(adjustment)).ReservedQuantity == 4, "adjustment never releases reservation");
    Check(!(await Adjust(adjustment, int.MinValue)).IsSuccess, "int.MinValue adjustment rejects without overflow");
    var overflow = await Fixture(int.MaxValue, 0);
    Check(!(await Adjust(overflow, 1)).IsSuccess, "adjustment int overflow rejects");
    var ambiguous = await Fixture(); await DuplicateStatus(ambiguous, InventoryStatus.QCHold);
    Check(!(await Adjust(ambiguous, 1)).IsSuccess, "ambiguous Status adjustment lookup rejects");
    var blank = await Fixture();
    await Change(db => db.BinInventories.Add(new BinInventory { Id = Guid.NewGuid(), BinId = blank.Source, ProductId = blank.Product,
        LotNumber = "", Quantity = 2, Status = InventoryStatus.Available }));
    Check(!(await Adjust(blank, 1)).IsSuccess, "ambiguous normalized Lot lookup rejects");
    var serial = await Fixture(mode: ProductTrackingMode.Serial);
    Check(!(await Transfer(serial, 1)).IsSuccess, "Serial transfer rejects");
    Check(!(await Adjust(serial, 1)).IsSuccess, "Serial adjustment rejects");
    var invalidHierarchy = await Fixture();
    await Change(db => { var z = db.Zones.Single(x => x.Id == invalidHierarchy.Zone); z.IsDeleted = true; });
    Check(!(await Transfer(invalidHierarchy, 1)).IsSuccess, "deleted hierarchy transfer rejects");
    var metadata = await Fixture();
    await Change(db => db.BinInventories.Add(new BinInventory { Id = Guid.NewGuid(), BinId = metadata.Destination, ProductId = metadata.Product,
        LotNumber = "LOT-DEFAULT", Quantity = 0, Status = InventoryStatus.Available, ExpirationDate = DateTime.UtcNow.AddDays(2) }));
    Check(!(await Transfer(metadata, 1)).IsSuccess, "destination expiry mismatch rejects");
    var lpn = await Fixture();
    var sourceLpn = await Stock(lpn);
    await Change(db => db.BinInventories.Add(new BinInventory { Id = Guid.NewGuid(), BinId = lpn.Destination, ProductId = lpn.Product,
        LotNumber = "LOT-DEFAULT", Quantity = 0, Status = InventoryStatus.Available, ExpirationDate = sourceLpn.ExpirationDate, LpnCode = "OTHER" }));
    Check(!(await Transfer(lpn, 1)).IsSuccess, "destination LPN mismatch rejects");
    foreach (var quantity in new[] { 3, 10 })
    {
        var lpnSource = await Fixture(reserved: 0);
        await Change(db => db.BinInventories.Single(x => x.Id == lpnSource.Stock).LpnCode = "SOURCE-LPN");
        var beforeLpn = await Stock(lpnSource);
        var ledgerBeforeLpn = await Ledger();
        await using var inspect = Db();
        var beforeBins = await inspect.Bins.AsNoTracking().Where(x => x.Id == lpnSource.Source || x.Id == lpnSource.Destination)
            .ToDictionaryAsync(x => x.Id, x => x.CurrentOccupancy);
        var result = await Transfer(lpnSource, quantity);
        Check(!result.IsSuccess && result.Error?.Code == "VAL_1000", $"source LPN quantity transfer {quantity}/10 rejects");
        var afterLpn = await Stock(lpnSource);
        Check(afterLpn.Quantity == beforeLpn.Quantity && afterLpn.LpnCode == beforeLpn.LpnCode &&
            afterLpn.RowVersion.SequenceEqual(beforeLpn.RowVersion), $"LPN rejection {quantity}/10 preserves source quantity/LPN/RowVersion");
        Check(!await inspect.BinInventories.AnyAsync(x => x.BinId == lpnSource.Destination), $"LPN rejection {quantity}/10 creates no destination inventory");
        var afterBins = await inspect.Bins.AsNoTracking().Where(x => x.Id == lpnSource.Source || x.Id == lpnSource.Destination)
            .ToDictionaryAsync(x => x.Id, x => x.CurrentOccupancy);
        Check(beforeBins.All(x => afterBins[x.Key] == x.Value), $"LPN rejection {quantity}/10 preserves both occupancies");
        Check(await Ledger() == ledgerBeforeLpn, $"LPN rejection {quantity}/10 preserves ledger");
    }
    var capacity = await Fixture();
    await Change(db => db.Bins.Single(x => x.Id == capacity.Destination).MaxCapacity = 0);
    Check(!(await Transfer(capacity, 1)).IsSuccess, "transfer capacity rejects before mutation");
    var occupied = await Fixture();
    await Change(db => db.Bins.Single(x => x.Id == occupied.Source).CurrentOccupancy = 0);
    Check(!(await Transfer(occupied, 1)).IsSuccess, "transfer negative occupancy rejects");
    var statusFixture = await Fixture();
    Check(!(await Status(statusFixture, InventoryStatus.QCHold)).IsSuccess, "status actual change with reserved rejects");
    var count = await Ledger(); var original = await Stock(statusFixture);
    NotificationProbe.Published = 0;
    Check((await Status(statusFixture, InventoryStatus.Available)).IsSuccess, "same-status succeeds with reservation");
    var afterNoop = await Stock(statusFixture);
    Check(await Ledger() == count && NotificationProbe.Published == 0 && original.RowVersion.SequenceEqual(afterNoop.RowVersion), "same-status no ledger/event/write");
    var unreserved = await Fixture(reserved: 0);
    Check(!(await Status(unreserved, InventoryStatus.Reserved)).IsSuccess, "actual status -> Reserved rejects");
    Check((await Status(unreserved, InventoryStatus.QCHold, true)).IsSuccess, "notification failure does not fail committed status mutation");
    Check((await Stock(unreserved)).Status == InventoryStatus.QCHold && (await Stock(unreserved)).Quantity == 10, "status changes only status, preserves quantity");
    Check(!(await Status(ambiguous, InventoryStatus.QCHold)).IsSuccess, "target status identity collision rejects without merge");
    var alreadyReserved = await Fixture(status: InventoryStatus.Reserved);
    Check((await Status(alreadyReserved, InventoryStatus.Reserved)).IsSuccess, "same Reserved status remains a no-op");
    var parallelTransfer = await Fixture();
    var transferResults = await Task.WhenAll(Transfer(parallelTransfer, 6), Transfer(parallelTransfer, 6));
    Check(transferResults.Count(x => x.IsSuccess) == 1 && (await Stock(parallelTransfer)).Quantity == 4,
        "two concurrent transfers cannot overspend Available");
    var parallelAdjustment = await Fixture();
    var adjustmentResults = await Task.WhenAll(Adjust(parallelAdjustment, -6), Adjust(parallelAdjustment, -6));
    Check(adjustmentResults.Count(x => x.IsSuccess) == 1 && (await Stock(parallelAdjustment)).Quantity == 4,
        "two concurrent adjustments cannot consume reservation");

    // Real relational workflow fixtures; no allocation/picking business commands are executed.
    async Task Workflow(Fixture f, string kind)
    {
        await using var db = Db();
        var order = new OutboundIssue { Id = Guid.NewGuid(), OrderNumber = Guid.NewGuid().ToString("N"), BinId = f.Source, IsDeleted = true };
        var line = new OutboundOrderItem { Id = Guid.NewGuid(), OrderId = order.Id, ProductId = f.Product, Quantity = 1 };
        order.Items.Add(line);
        var allocation = new OutboundAllocation { Id = Guid.NewGuid(), Order = order, Generation = 1, SourceBinId = f.Source,
            StagingBinId = f.Destination, IsActive = kind == "allocation", Status = kind == "allocation" ? "Active" : "Released" };
        db.OutboundAllocations.Add(allocation);
        if (kind is not "allocation" and not "empty")
        {
            var reservation = new InventoryReservation { Id = Guid.NewGuid(), Allocation = allocation, OrderId = order.Id,
                OrderItem = line, SourceBinInventoryId = f.Stock, Quantity = 1,
                Status = kind == "reservation" ? "Active" : "Released", ReleasedQuantity = kind == "reservation" ? 0 : 1 };
            db.InventoryReservations.Add(reservation);
            if (kind == "staging")
            {
                var other = new BinInventory { Id = Guid.NewGuid(), BinId = f.Destination, ProductId = f.Product,
                    LotNumber = "LOT-DEFAULT", Status = InventoryStatus.Available };
                db.BinInventories.Add(other);
                reservation.SourceBinInventoryId = other.Id; reservation.StagingBinInventoryId = f.Stock;
                reservation.PickedQuantity = 1; reservation.ReleasedQuantity = 0; reservation.Status = "Picked";
            }
            if (kind is "task" or "wave")
            {
                var task = new PickTask { Id = Guid.NewGuid(), AllocationId = allocation.Id,
                    Reservation = reservation, SourceBinId = f.Source, StagingBinId = f.Destination, Quantity = 1,
                    Status = kind == "wave" ? "Completed" : "Ready" };
                db.PickTasks.Add(task);
                if (kind == "wave")
                {
                    var warehouse = await db.Zones.Where(x => x.Id == f.Zone).Select(x => x.WarehouseId).SingleAsync();
                    var wave = new Wave { Id = Guid.NewGuid(), WarehouseId = warehouse, WaveCode = Guid.NewGuid().ToString("N"),
                        CanonicalTaskSet = task.Id.ToString(), TaskSetHash = Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N") };
                    db.WavePickTasks.Add(new WavePickTask { Wave = wave, PickTask = task, IsActive = true });
                }
            }
        }
        await db.SaveChangesAsync();
    }
    var workflowStock = await Fixture(reserved: 0, expiryDays: -1); await Workflow(workflowStock, "reservation");
    var taskStock = await Fixture(reserved: 0, expiryDays: -1); await Workflow(taskStock, "task");
    var allocationStock = await Fixture(reserved: 0, expiryDays: -1); await Workflow(allocationStock, "allocation");
    var waveStock = await Fixture(reserved: 0, expiryDays: -1); await Workflow(waveStock, "wave");
    var stagingStock = await Fixture(reserved: 0, expiryDays: -1); await Workflow(stagingStock, "staging");
    var historical = await Fixture(reserved: 0); await Workflow(historical, "historical");
    Check((await Status(historical, InventoryStatus.QCHold)).IsSuccess, "terminal historical reference alone does not block status");
    Check(!(await Status(workflowStock, InventoryStatus.Damaged)).IsSuccess, "workflow reference blocks status even with zero reserved and deleted header");
    var expiredReserved = await Fixture(expiryDays: -1);
    var expiredJob = await Fixture(reserved: 0, expiryDays: -1);
    var nearExpiry = await Fixture(reserved: 0, expiryDays: 10);
    var jobLogger = new ProbeLogger<InventoryJobService>();
    var mediatorJob = DispatchProxy.Create<IMediator, NotificationProbe>();
    ((NotificationProbe)(object)mediatorJob).Fail = true;
    await using (var db = Db()) await new InventoryJobService(db, mediatorJob, new InventoryMutationCoordinator(db), jobLogger).RunExpiredStockLockJobAsync();
    Check((await Stock(expiredJob)).Status == InventoryStatus.Damaged, "expiry job Available -> Damaged, notification failure contained");
    Check((await Stock(nearExpiry)).Status == InventoryStatus.Available, "expiry job does not lock within future 30-day window");
    Check((await Stock(expiredReserved)).Status == InventoryStatus.Available && (await Stock(expiredReserved)).ReservedQuantity == 4, "expiry job skips reserved without release");
    foreach (var f in new[] { workflowStock, taskStock, allocationStock, waveStock, stagingStock }) Check((await Stock(f)).Status == InventoryStatus.Available, "expiry job skips workflow " + f.Stock);
    await using (var db = Db())
    {
        var result = await new LockExpiredStockCommandHandler(db, new ProbeLogger<LockExpiredStockCommandHandler>(), new InventoryMutationCoordinator(db)).Handle(new(), default);
        Check(result.IsSuccess && result.Data == 2, "expiry command counts both eligible fixture rows (near-expiry and metadata fixture)");
    }
    Check((await Stock(nearExpiry)).Status == InventoryStatus.Expired, "expiry command preserves 30-day Available -> Expired rule");
    Check((await Stock(expiredJob)).Status == InventoryStatus.Damaged, "command does not rewrite job Damaged result");
    foreach (var f in new[] { expiredReserved, workflowStock, taskStock, allocationStock, waveStock, stagingStock }) Check((await Stock(f)).Status == InventoryStatus.Available, "expiry command skips reserved/workflow " + f.Stock);

    // Real RowVersion conflict: pretracked stale entities from a separate committed SQL writer.
    var stale = await Fixture();
    await using (var db = Db())
    {
        await db.BinInventories.SingleAsync(x => x.Id == stale.Stock);
        await Change(other => other.BinInventories.Single(x => x.Id == stale.Stock).Quantity++);
        var result = await Transfer(stale, 1, db);
        Check(!result.IsSuccess && result.Error?.Code == "COM_409", "real inventory RowVersion conflict maps COM_409");
        Check(!db.ChangeTracker.Entries().Any(), "rollback clears tracked mutation/audit entries");
    }
    Check((await Stock(stale)).Quantity == 11, "RowVersion failure preserves concurrent writer and rolls back transfer");
    var staleBin = await Fixture();
    await using (var db = Db())
    {
        await db.Bins.SingleAsync(x => x.Id == staleBin.Source);
        await Change(other => other.Bins.Single(x => x.Id == staleBin.Source).CurrentOccupancy++);
        var result = await Adjust(staleBin, 1, db);
        Check(!result.IsSuccess && result.Error?.Code == "COM_409", "real Bin RowVersion conflict maps COM_409");
    }
    Check((await Stock(staleBin)).Quantity == 10, "Bin RowVersion conflict rolls back stock and ledger");

    // Unique insert race is tested with two independent contexts, the losing writer gets a real SQL error.
    var unique = await Fixture(reserved: 0);
    await using (var first = Db())
    await using (var second = Db())
    {
        Check(!await first.BinInventories.AnyAsync(x => x.BinId == unique.Destination), "unique race initial absence");
        Check(!await second.BinInventories.AnyAsync(x => x.BinId == unique.Destination), "unique race second reader sees absence");
        BinInventory Row() => new() { Id = Guid.NewGuid(), BinId = unique.Destination, ProductId = unique.Product,
            LotNumber = "LOT-DEFAULT", Quantity = 1, Status = InventoryStatus.Available };
        first.Add(Row()); second.Add(Row()); await first.SaveChangesAsync();
        try { await second.SaveChangesAsync(); throw new Exception("Unique race unexpectedly succeeded"); }
        catch (DbUpdateException ex) { Check(new InventoryMutationCoordinator(second).IsConflict(ex), "real unique identity race classified as COM_409 conflict"); }
    }
    // Same production locking path prevents a concurrent insert after an absence read.
    var absence = await Fixture(reserved: 0);
    await using (var guardDb = Db())
    {
        var guard = new InventoryMutationCoordinator(guardDb);
        await using var tx = await guard.BeginAsync(default);
        await guard.LockLotAsync(absence.Destination, absence.Product, "LOT-DEFAULT", default);
        await using var contender = Db();
        await contender.Database.OpenConnectionAsync();
        await contender.Database.ExecuteSqlRawAsync("SET LOCK_TIMEOUT 500");
        contender.BinInventories.Add(new BinInventory { Id = Guid.NewGuid(), BinId = absence.Destination, ProductId = absence.Product,
            LotNumber = "LOT-DEFAULT", Quantity = 1, Status = InventoryStatus.Available });
        try { await contender.SaveChangesAsync(); throw new Exception("Absence range was not protected"); }
        catch (Exception ex) when (ex.GetBaseException() is SqlException sql && sql.Number == 1222)
        { Check(new InventoryMutationCoordinator(contender).IsConflict(ex), "identity absence range blocks concurrent insert; wrapped lock conflict classified"); }
        await tx.RollbackAsync();
    }

    var referenceRace = await Fixture(reserved: 0);
    await Workflow(referenceRace, "empty");
    await using (var guardDb = Db())
    {
        var guard = new InventoryMutationCoordinator(guardDb);
        await using var tx = await guard.BeginAsync(default);
        var inventory = await guardDb.BinInventories.SingleAsync(x => x.Id == referenceRace.Stock);
        Check(!await guard.HasWorkflowAsync(inventory, default), "workflow race starts with no outstanding reference");
        await using var contender = Db();
        var allocation = await contender.OutboundAllocations.SingleAsync(x => x.SourceBinId == referenceRace.Source);
        var line = await contender.OutboundOrderItems.SingleAsync(x => x.OrderId == allocation.OrderId);
        await contender.Database.OpenConnectionAsync();
        await contender.Database.ExecuteSqlRawAsync("SET LOCK_TIMEOUT 500");
        contender.InventoryReservations.Add(new InventoryReservation { Id = Guid.NewGuid(), AllocationId = allocation.Id,
            OrderId = allocation.OrderId, OrderItemId = line.Id, SourceBinInventoryId = referenceRace.Stock, Quantity = 1 });
        try { await contender.SaveChangesAsync(); throw new Exception("Workflow absence was not protected"); }
        catch (Exception ex) when (ex.GetBaseException() is SqlException sql && sql.Number == 1222)
        { Check(true, "workflow absence range blocks concurrent reservation insertion"); }
        await tx.RollbackAsync();
    }

    // Exercise the actual handler's catch/rollback boundary with a real SQL 1222, not a classifier-only test.
    // The handler locks GUID-sorted bins, not source first. A destination range scan can block
    // before the source query. Route this source-specific probe to the first attempted lock.
    var timeoutFixture = await Fixture(reserved: 0, sourceFirst: true);
    Check(timeoutFixture.Source.CompareTo(timeoutFixture.Destination) < 0,
        "lock-timeout fixture source is first in the production GUID lock order");
    var timeoutStockBefore = await Stock(timeoutFixture);
    var timeoutLedgerBefore = await Ledger();
    var timeoutProbe = new LockTimeoutProbe(timeoutFixture.Source);
    using var timeoutLogs = LoggerFactory.Create(builder => builder.AddProvider(timeoutProbe));
    await using (var blockedHandlerDb = new ApplicationDbContext(
        new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(testConnection)
            .AddInterceptors(timeoutProbe).UseLoggerFactory(timeoutLogs).Options, new VerificationUser()))
    {
        await blockedHandlerDb.Database.OpenConnectionAsync();
        await blockedHandlerDb.Database.ExecuteSqlRawAsync("SET LOCK_TIMEOUT 500");
        var binsBefore = await blockedHandlerDb.Bins.Where(x => x.Id == timeoutFixture.Source || x.Id == timeoutFixture.Destination)
            .ToDictionaryAsync(x => x.Id, x => x.CurrentOccupancy);
        // Ensure Clear() is observable even if query materialization changes in the handler.
        await blockedHandlerDb.Bins.Where(x => x.Id == timeoutFixture.Source).LoadAsync();
        Check(blockedHandlerDb.ChangeTracker.Entries().Any(), "lock-timeout handler starts with tracked state");
        await using (var blockerDb = Db())
        {
            var blocker = new InventoryMutationCoordinator(blockerDb);
            await using var blockingTransaction = await blocker.BeginAsync(default);
            await blocker.LockLotAsync(timeoutFixture.Source, timeoutFixture.Product, "LOT-DEFAULT", default);
            var result = await Transfer(timeoutFixture, 1, blockedHandlerDb);
            await File.WriteAllTextAsync(Path.Combine(report, "lock-timeout-evidence.json"), JsonSerializer.Serialize(new
            {
                timeoutFixture.Source, timeoutFixture.Destination, timeoutFixture.Stock,
                SourceSortsFirst = timeoutFixture.Source.CompareTo(timeoutFixture.Destination) < 0,
                LockTimeoutMilliseconds = 500,
                timeoutProbe.SourceLockAttempts, timeoutProbe.TimeoutCount, timeoutProbe.Commands
            }, new JsonSerializerOptions { WriteIndented = true }));
            Check(!result.IsSuccess && result.Error?.Code == "COM_409", "production Transfer handler returns COM_409 for SQL 1222 without escaping exception");
            Check(timeoutProbe.TimeoutCount == 1 && timeoutProbe.SourceLockAttempts == 1,
                $"handler encountered exactly one real SQL 1222; no mutation retry (timeouts={timeoutProbe.TimeoutCount}, attempts={timeoutProbe.SourceLockAttempts})");
            Check(!blockedHandlerDb.ChangeTracker.Entries().Any(), "handler lock-timeout rollback clears ChangeTracker");
            Check(blockedHandlerDb.Database.CurrentTransaction == null, "handler lock-timeout disposes transaction");
            await blockingTransaction.RollbackAsync();
        }
        var timeoutStockAfter = await Stock(timeoutFixture);
        Check(timeoutStockAfter.Quantity == timeoutStockBefore.Quantity && timeoutStockAfter.ReservedQuantity == timeoutStockBefore.ReservedQuantity &&
            timeoutStockAfter.RowVersion.SequenceEqual(timeoutStockBefore.RowVersion), "handler lock-timeout preserves stock");
        var binsAfter = await blockedHandlerDb.Bins.AsNoTracking().Where(x => x.Id == timeoutFixture.Source || x.Id == timeoutFixture.Destination)
            .ToDictionaryAsync(x => x.Id, x => x.CurrentOccupancy);
        Check(binsBefore.All(x => binsAfter[x.Key] == x.Value) &&
            !await blockedHandlerDb.BinInventories.AnyAsync(x => x.BinId == timeoutFixture.Destination) && await Ledger() == timeoutLedgerBefore,
            "handler lock-timeout leaves no partial occupancy/destination/ledger");
        await using var usableTransaction = await blockedHandlerDb.Database.BeginTransactionAsync();
        Check(await blockedHandlerDb.Database.SqlQuery<int>($"SELECT 1 AS [Value]").SingleAsync() == 1 &&
            await blockedHandlerDb.BinInventories.AsNoTracking().AnyAsync(x => x.Id == timeoutFixture.Stock),
            "same handler DbContext/connection usable in a new transaction after rollback");
        await usableTransaction.RollbackAsync();
    }

    // Predicate absence must also protect active allocations with no reservation yet, on either bin role.
    foreach (var stagingMatch in new[] { false, true })
    {
        var allocationRace = await Fixture(reserved: 0);
        var orderId = Guid.NewGuid();
        await Change(db =>
        {
            var order = new OutboundIssue { Id = orderId, OrderNumber = Guid.NewGuid().ToString("N"), BinId = allocationRace.Source };
            order.Items.Add(new OutboundOrderItem { Id = Guid.NewGuid(), OrderId = orderId, ProductId = allocationRace.Product, Quantity = 1 });
            db.OutboundIssues.Add(order);
        });
        var role = stagingMatch ? "staging" : "source";
        await using (var guardDb = Db())
        {
            var guard = new InventoryMutationCoordinator(guardDb);
            await using var t1 = await guard.BeginAsync(default);
            var stock = await guardDb.BinInventories.SingleAsync(x => x.Id == allocationRace.Stock);
            Check(!await guard.HasWorkflowAsync(stock, default), $"active allocation {role} absence race: T1 guard false");
            await using var contender = Db();
            await contender.Database.OpenConnectionAsync();
            await contender.Database.ExecuteSqlRawAsync("SET LOCK_TIMEOUT 500");
            await using (var t2 = await contender.Database.BeginTransactionAsync())
            {
                contender.OutboundAllocations.Add(new OutboundAllocation { Id = Guid.NewGuid(), OrderId = orderId,
                    Generation = 1, IsActive = true, Status = "Active",
                    SourceBinId = stagingMatch ? allocationRace.Destination : allocationRace.Source,
                    StagingBinId = stagingMatch ? allocationRace.Source : allocationRace.Destination });
                try { await contender.SaveChangesAsync(); throw new Exception("Active allocation absence was not protected"); }
                catch (Exception ex) when (ex.GetBaseException() is SqlException sql && sql.Number == 1222)
                { Check(true, $"active allocation {role} absence race: T2 insert blocked by SQL 1222 while T1 held"); }
                finally { await t2.RollbackAsync(); contender.ChangeTracker.Clear(); }
            }
            await t1.RollbackAsync();
        }
        await using var verify = Db();
        Check(!await verify.OutboundAllocations.AnyAsync(x => x.OrderId == orderId), $"active allocation {role} race cleanup leaves no allocation");
    }

    // A deliberately stale second row makes the real batch save fail after at least one earlier update.
    foreach (var job in new[] { false, true })
    {
        var a = await Fixture(reserved: 0, expiryDays: -1);
        var b = await Fixture(reserved: 0, expiryDays: -1);
        var ledgerBefore = await Ledger(); NotificationProbe.Published = 0;
        await using var db = Db();
        await db.BinInventories.Where(x => x.Id == a.Stock || x.Id == b.Stock).LoadAsync();
        await Change(other => other.BinInventories.Single(x => x.Id == b.Stock).Quantity++);
        if (job)
        {
            var logger = new ProbeLogger<InventoryJobService>();
            await new InventoryJobService(db, DispatchProxy.Create<IMediator, NotificationProbe>(), new InventoryMutationCoordinator(db), logger).RunExpiredStockLockJobAsync();
            Check(logger.Messages.Any(x => x.Contains("rolled back")) && !logger.Messages.Any(x => x.Contains("Expiry job committed")), "job conflict logs rollback, no false success");
        }
        else
        {
            var logger = new ProbeLogger<LockExpiredStockCommandHandler>();
            var result = await new LockExpiredStockCommandHandler(db, logger, new InventoryMutationCoordinator(db)).Handle(new(), default);
            Check(!result.IsSuccess && result.Error?.Code == "COM_409" && !logger.Messages.Any(x => x.Contains("Expiry command committed")), "command batch conflict COM_409, no false success");
        }
        Check((await Stock(a)).Status == InventoryStatus.Available && (await Stock(b)).Status == InventoryStatus.Available &&
            await Ledger() == ledgerBefore && NotificationProbe.Published == 0, (job ? "job" : "command") + " conflict has no partial commit/ledger/event");
        Check(!db.ChangeTracker.Entries().Any(), "expiry rollback clears tracker");
        // Retire only this test's rows to keep later global expiry tests independent.
        await Change(other => { other.BinInventories.Single(x => x.Id == a.Stock).ExpirationDate = DateTime.UtcNow.AddYears(1);
            other.BinInventories.Single(x => x.Id == b.Stock).ExpirationDate = DateTime.UtcNow.AddYears(1); });
    }
}
finally
{
    SqlConnection.ClearAllPools();
    if (!database.StartsWith("SmartWMS_Phase4A_Verify_", StringComparison.Ordinal) || database.Length != 56)
        throw new Exception("Refusing cleanup of unexpected database name");
    await using var master = new SqlConnection(new SqlConnectionStringBuilder(production) { InitialCatalog = "master" }.ConnectionString);
    await master.OpenAsync();
    await using var cleanup = master.CreateCommand();
    cleanup.CommandText = $"IF DB_ID(N'{database}') IS NOT NULL BEGIN ALTER DATABASE [{database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{database}]; END";
    await cleanup.ExecuteNonQueryAsync();
    Check(true, "isolated fixture database cleanup completed");
    var after = await Snapshot(production);
    await File.WriteAllTextAsync(Path.Combine(report, "after.json"), JsonSerializer.Serialize(after, new JsonSerializerOptions { WriteIndented = true }));
    Check(before.Count == after.Count && before.All(x => after.TryGetValue(x.Key, out var value) && value == x.Value), "business/workflow/Hangfire/schema snapshots unchanged");
    await File.WriteAllLinesAsync(Path.Combine(report, "results.txt"), results);
}
Console.WriteLine($"ALL {results.Count} CHECKS PASSED");

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
record Fixture(Guid Stock, Guid Source, Guid Destination, Guid Product, Guid Zone);
sealed class LockTimeoutProbe(Guid sourceBin) : DbCommandInterceptor, ILoggerProvider, ILogger
{
    public int TimeoutCount { get; private set; }
    public int SourceLockAttempts { get; private set; }
    public List<object> Commands { get; } = new();
    public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command, CommandEventData eventData,
        InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
    {
        Commands.Add(new { command.CommandText, Isolation = command.Transaction?.IsolationLevel.ToString(),
            Parameters = command.Parameters.Cast<DbParameter>().Select(x => new { x.ParameterName,
                Type = x.Value?.GetType().FullName, Value = x.Value?.ToString() }).ToArray() });
        if (command.CommandText.Contains("UPDLOCK", StringComparison.Ordinal) &&
            command.Parameters.Cast<DbParameter>().Any(x => x.Value is Guid id && id == sourceBin)) SourceLockAttempts++;
        return ValueTask.FromResult(result);
    }
    // SQL can return a reader first and report 1222 during enumeration, after CommandExecuted.
    public ILogger CreateLogger(string categoryName) => this;
    public void Dispose() { }
    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
    public bool IsEnabled(LogLevel level) => true;
    public void Log<TState>(LogLevel level, EventId id, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
    {
        if (id.Id == CoreEventId.QueryIterationFailed.Id &&
            exception?.GetBaseException() is SqlException sql && sql.Number == 1222) TimeoutCount++;
    }
}
sealed class VerificationUser : ICurrentUserService { public string UserId => "Phase4A-Verification"; public string Role => "Admin"; public string IpAddress => "127.0.0.1"; }
public class NotificationProbe : DispatchProxy
{
    public static int Published;
    public bool Fail;
    protected override object? Invoke(MethodInfo? method, object?[]? arguments)
    {
        if (method?.Name != "Publish") throw new NotSupportedException(method?.Name);
        Interlocked.Increment(ref Published);
        return Fail ? Task.FromException(new InvalidOperationException("Verification notification failure")) : Task.CompletedTask;
    }
}
sealed class ProbeLogger<T> : ILogger<T>
{
    public List<string> Messages { get; } = new();
    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
    public bool IsEnabled(LogLevel level) => true;
    public void Log<TState>(LogLevel level, EventId id, TState state, Exception? exception, Func<TState, Exception?, string> formatter) => Messages.Add(formatter(state, exception));
}
