using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Kitting.Commands.AssembleKit;
using SmartWMS.Application.Features.Kitting.DTOs.Commands;
using SmartWMS.Application.Features.OutboundOrders;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums;
using SmartWMS.Infrastructure.Persistence.DbContext;
using SmartWMS.Infrastructure.Services;

if (args.Length < 2 || args[0] is not ("--focused" or "--http" or "--regression"))
    throw new ArgumentException("--focused <report> | --http <report> <api-dll> | --regression <report> <mirror-root>");
var report = Path.GetFullPath(args[1]); Directory.CreateDirectory(report);
var results = new List<string>();
void Check(bool ok, string label) { results.Add((ok ? "PASS: " : "FAIL: ") + label); Console.WriteLine(results[^1]); if (!ok) throw new Exception(results[^1]); }
try
{
    if (args[0] == "--http") await HttpSmoke.Run(report, args[2], Check);
    else if (args[0] == "--regression") await RegressionSmoke.Run(report, args[2], Check);
    else await Focused();
    Console.WriteLine($"ALL {results.Count} K1 CHECKS PASSED");
}
finally { await File.WriteAllLinesAsync(Path.Combine(report, "results.txt"), results); }

async Task Focused()
{
    await using var fixture = new FixtureDatabase("K1 focused SQL Server: no business/shared DB access");
    Console.WriteLine("Fixture database: " + fixture.Name);
    ApplicationDbContext Db(params IInterceptor[] interceptors) => new(new DbContextOptionsBuilder<ApplicationDbContext>()
        .UseSqlServer(fixture.Connection).AddInterceptors(interceptors).Options, new FixtureUser());
    await using (var db = Db())
    {
        await db.Database.MigrateAsync();
        Check((await db.Database.GetAppliedMigrationsAsync()).Count() == 31, "existing 31 migrations create isolated relational fixture; no K1 migration");
        Check(!db.Database.HasPendingModelChanges(), "K1 model still matches B3 snapshot");
    }
    async Task<F> Seed(int quantity = 10, int reserved = 0, bool sameBin = false, double capacity = 100)
    {
        await using var db = Db(); var tag = Guid.NewGuid().ToString("N");
        var wh = new Warehouse { Code = tag, Name = tag }; var zone = new Zone { Code = tag, Name = tag, Warehouse = wh };
        var source = new Bin { Id = Guid.NewGuid(), Code = "S" + tag, Zone = zone, MaxCapacity = 1000, CurrentOccupancy = quantity };
        var target = sameBin ? source : new Bin { Id = Guid.NewGuid(), Code = "T" + tag, Zone = zone, MaxCapacity = capacity };
        if (sameBin) target.MaxCapacity = capacity;
        var component = new Product { SKU = "C" + tag, Barcode = "C" + tag, Name = "Component" };
        var kit = new Product { SKU = "K" + tag, Barcode = "K" + tag, Name = "Kit" };
        var stock = new BinInventory { Bin = source, Product = component, LotNumber = "COMPONENT-LOT", Quantity = quantity,
            ReservedQuantity = reserved, Status = InventoryStatus.Available, ExpirationDate = DateTime.UtcNow.AddDays(100) };
        db.Bins.Add(target); db.Products.Add(kit); db.BinInventories.Add(stock); await db.SaveChangesAsync();
        return new(source.Id, target.Id, component.Id, kit.Id, stock.Id, zone.Id, wh.Id);
    }
    AssembleKitRequest Request(F f, int quantity = 2, int perKit = 2) => new() { KitProductId = f.Kit, TargetBinId = f.Target,
        AssembleQuantity = quantity, Components = new() { new() { ComponentProductId = f.Component, SourceBinId = f.Source, QuantityPerKit = perKit } } };
    async Task<Result<bool>> Run(AssembleKitRequest request, ApplicationDbContext? supplied = null)
    {
        var db = supplied ?? Db();
        try { return await new AssembleKitCommandHandler(db, new InventoryMutationCoordinator(db), new InboundReceiveCoordinator(db),
            new OutboundCoordinator(db, new InventoryMutationCoordinator(db))).Handle(new(request), default); }
        finally { if (supplied == null) await db.DisposeAsync(); }
    }
    async Task Change(Action<ApplicationDbContext> action) { await using var db = Db(); action(db); await db.SaveChangesAsync(); }
    async Task Reject(F f, string label, AssembleKitRequest? request = null)
    {
        var before = await FixtureDatabase.Snapshot(fixture.Connection);
        var result = await Run(request ?? Request(f));
        Check(!result.IsSuccess && result.Error?.Code is "VAL_1000" or "COM_409", label + " returns clean business failure");
        Check(before == await FixtureDatabase.Snapshot(fixture.Connection), label + " preserves every table, rowversion, ledger, audit and occupancy");
    }
    async Task Invariants(string label)
    {
        await using var db = Db();
        Check(!await db.BinInventories.AnyAsync(x => x.Quantity < 0 || x.ReservedQuantity < 0 || x.ReservedQuantity > x.Quantity), label + " quantities/reservations valid");
        var bins = await db.Bins.AsNoTracking().ToListAsync();
        var totals = await db.BinInventories.GroupBy(x => x.BinId).Select(g => new { Id = g.Key, Q = g.Sum(x => (long)x.Quantity) }).ToDictionaryAsync(x => x.Id, x => x.Q);
        Check(bins.All(x => x.CurrentOccupancy == totals.GetValueOrDefault(x.Id) && x.CurrentOccupancy >= 0 && x.CurrentOccupancy <= x.MaxCapacity), label + " occupancy equals physical sum and within capacity");
    }

    var happy = await Seed(reserved: 3); var req = Request(happy);
    Check((await Run(req)).IsSuccess, "happy path with ATP and multiplier succeeds");
    await using (var db = Db())
    {
        var source = await db.BinInventories.SingleAsync(x => x.Id == happy.Stock);
        var output = await db.BinInventories.SingleAsync(x => x.ProductId == happy.Kit);
        Check(source.Quantity == 6 && source.ReservedQuantity == 3, "multiplier 2 kits * 2 consumes 4; reserved ownership unchanged");
        Check(output.Quantity == 2 && output.LotNumber.StartsWith("KIT-") && output.Status == InventoryStatus.Available && output.LpnCode == null, "new output uses dated kit lot, Available, no LPN");
        Check((await db.Bins.FindAsync(happy.Source))!.CurrentOccupancy == 6 && (await db.Bins.FindAsync(happy.Target))!.CurrentOccupancy == 2, "source -4/destination +2 occupancy");
        var ledger = await db.InventoryTransactions.Where(x => x.BinInventoryId == happy.Stock || x.BinInventoryId == output.Id).ToListAsync();
        Check(ledger.Count == 2 && ledger.Single(x => x.TransactionType == "KITTING_ISSUE").QuantityChanged == -4 &&
            ledger.Single(x => x.TransactionType == "KITTING_RECEIPT").QuantityChanged == 2, "ledger signs and quantities unambiguous");
        Check(ledger.Select(x => x.ReasonCode).Distinct().Count() == 1 && ledger.All(x => x.BinInventoryId.HasValue), "ledger same operation correlation and exact inventory links");
        Check(ledger.Single(x => x.QuantityChanged < 0).SourceBinCode == (await db.Bins.FindAsync(happy.Source))!.Code &&
            ledger.Single(x => x.QuantityChanged > 0).DestinationBinCode == (await db.Bins.FindAsync(happy.Target))!.Code, "ledger actual source/destination");
        Check(await db.AuditLogs.AnyAsync(x => x.TableName == "BinInventories" && x.Type == "U") && await db.AuditLogs.AnyAsync(x => x.TableName == "InventoryTransactions" && x.Type == "C"), "DbContext audit pipeline covers mutation and ledger");
    }
    await Invariants("happy path");
    Check((await Run(req)).IsSuccess == false, "sequential repeat revalidates ATP rather than silently replaying output");
    // No idempotency key exists in the contract: an intentional repeat with enough ATP is a new operation.
    var repeat = await Seed(quantity: 20);
    Check((await Run(Request(repeat))).IsSuccess && (await Run(Request(repeat))).IsSuccess, "intentional repeat with sufficient ATP is two explicit operations; no hidden automatic retry");
    await using (var db = Db()) Check(await db.InventoryTransactions.CountAsync(x => x.ProductId == repeat.Kit) == 2 &&
        (await db.BinInventories.SingleAsync(x => x.ProductId == repeat.Kit)).Quantity == 4, "repeat output/ledger exactly once per invocation");

    var duplicate = await Seed(); var duplicateReq = Request(duplicate, 2, 2); duplicateReq.Components.Add(duplicateReq.Components[0]);
    Check((await Run(duplicateReq)).IsSuccess, "duplicate components aggregate before validation");
    await using (var db = Db()) Check((await db.BinInventories.FindAsync(duplicate.Stock))!.Quantity == 2 &&
        await db.InventoryTransactions.CountAsync(x => x.BinInventoryId == duplicate.Stock) == 1, "aggregated requirement 8, one issue ledger");
    var duplicateShort = await Seed(quantity: 6); var duplicateShortReq = Request(duplicateShort); duplicateShortReq.Components.Add(duplicateShortReq.Components[0]);
    await Reject(duplicateShort, "duplicate aggregate shortage", duplicateShortReq);

    var multiple = await Seed(); var other = await Seed(); var multiReq = Request(multiple);
    multiReq.Components.Add(new() { ComponentProductId = other.Component, SourceBinId = other.Source, QuantityPerKit = 3 });
    Check((await Run(multiReq)).IsSuccess, "multiple components across bins");
    await using (var db = Db()) Check((await db.BinInventories.FindAsync(other.Stock))!.Quantity == 4 &&
        await db.InventoryTransactions.CountAsync(x => x.ProductId == multiple.Kit) == 1, "multiple multiplier consumption and one output receipt");
    var sameSource = await Seed();
    Guid extraId = Guid.NewGuid();
    await Change(db => { db.Products.Add(new Product { Id = extraId, SKU = extraId.ToString(), Barcode = extraId.ToString(), Name = "Extra" });
        db.BinInventories.Add(new BinInventory { BinId = sameSource.Source, ProductId = extraId, LotNumber = "EXTRA", Quantity = 10, Status = InventoryStatus.Available });
        db.Bins.Single(x => x.Id == sameSource.Source).CurrentOccupancy += 10; });
    var sameSourceReq = Request(sameSource); sameSourceReq.Components.Add(new() { ComponentProductId = extraId, SourceBinId = sameSource.Source, QuantityPerKit = 3 });
    Check((await Run(sameSourceReq)).IsSuccess, "multiple component rows in one source bin");
    await using (var db = Db()) Check((await db.Bins.FindAsync(sameSource.Source))!.CurrentOccupancy == 10, "same-source occupancy aggregated -10 exactly once");

    var same = await Seed(sameBin: true, capacity: 10);
    Check((await Run(Request(same))).IsSuccess, "full same-bin capacity succeeds using net consumption/output");
    await using (var db = Db()) Check((await db.Bins.FindAsync(same.Source))!.CurrentOccupancy == 8, "same-bin net -4+2 = -2");
    var exact = await Seed(capacity: 2); Check((await Run(Request(exact))).IsSuccess, "destination capacity exact boundary succeeds");
    var emptySource = await Seed(quantity: 4);
    Check((await Run(Request(emptySource))).IsSuccess, "exact component quantity consumed to zero");
    await using (var db = Db()) Check((await db.BinInventories.FindAsync(emptySource.Stock))!.Quantity == 0 &&
        (await db.Bins.FindAsync(emptySource.Source))!.CurrentOccupancy == 0, "zero row retained, source occupancy exactly zero");
    var lot = await Seed();
    await Change(db => { db.Products.Single(x => x.Id == lot.Component).TrackingMode = ProductTrackingMode.Lot; db.Products.Single(x => x.Id == lot.Kit).TrackingMode = ProductTrackingMode.Lot; });
    Check((await Run(Request(lot))).IsSuccess, "None/Lot scope: Lot component and dated Lot kit output supported");
    var over = await Seed(capacity: 1); await Reject(over, "destination capacity overflow");
    var insufficient = await Seed(quantity: 3); await Reject(insufficient, "insufficient physical");
    var reserved = await Seed(reserved: 8); await Reject(reserved, "reserved stock ATP exclusion");
    foreach (var status in new[] { InventoryStatus.QCHold, InventoryStatus.Damaged, InventoryStatus.Expired, InventoryStatus.Reserved })
    {
        var f = await Seed(); await Change(db => db.BinInventories.Single(x => x.Id == f.Stock).Status = status);
        await Reject(f, "component status " + status);
    }
    foreach (var kind in new[] { "missing-product", "deleted-component", "deleted-kit", "deleted-source", "deleted-target", "deleted-zone", "deleted-warehouse", "expired", "lpn-source", "serial-product", "serial-kit", "serial-evidence", "occupancy-drift", "ambiguous-lot", "blank-lot" })
    {
        var f = await Seed();
        await Change(db =>
        {
            var stock = db.BinInventories.Single(x => x.Id == f.Stock);
            switch (kind)
            {
                case "deleted-component": db.Products.Single(x => x.Id == f.Component).IsDeleted = true; break;
                case "deleted-kit": db.Products.Single(x => x.Id == f.Kit).IsDeleted = true; break;
                case "deleted-source": db.Bins.Single(x => x.Id == f.Source).IsDeleted = true; break;
                case "deleted-target": db.Bins.Single(x => x.Id == f.Target).IsDeleted = true; break;
                case "deleted-zone": db.Zones.Single(x => x.Id == f.Zone).IsDeleted = true; break;
                case "deleted-warehouse": db.Warehouses.Single(x => x.Id == f.Warehouse).IsDeleted = true; break;
                case "expired": stock.ExpirationDate = DateTime.UtcNow.AddDays(-1); break;
                case "lpn-source": stock.LpnCode = "PALLET"; break;
                case "serial-product": db.Products.Single(x => x.Id == f.Component).TrackingMode = ProductTrackingMode.Serial; break;
                case "serial-kit": db.Products.Single(x => x.Id == f.Kit).TrackingMode = ProductTrackingMode.Serial; break;
                case "serial-evidence": db.ProductSerialNumbers.Add(new() { Id = Guid.NewGuid(), ProductId = f.Component, BinInventoryId = stock.Id, SerialCode = Guid.NewGuid().ToString() }); break;
                case "occupancy-drift": db.Bins.Single(x => x.Id == f.Source).CurrentOccupancy--; break;
                case "ambiguous-lot": db.BinInventories.Add(new BinInventory { BinId = f.Source, ProductId = f.Component, LotNumber = "ANOTHER-LOT", Quantity = 1, Status = InventoryStatus.Available }); db.Bins.Single(x => x.Id == f.Source).CurrentOccupancy++; break;
                case "blank-lot": db.Products.Single(x => x.Id == f.Component).TrackingMode = ProductTrackingMode.Lot; stock.LotNumber = " "; break;
            }
        });
        var request = Request(f); if (kind == "missing-product") request.Components[0].ComponentProductId = Guid.NewGuid();
        await Reject(f, kind, request);
        // Remove the deliberately injected fixture drift only after proving rejection was side-effect-free.
        if (kind == "occupancy-drift") await Change(db => db.Bins.Single(x => x.Id == f.Source).CurrentOccupancy++);
    }
    var identityTest = await Seed();
    await Change(db => { db.BinInventories.Add(new BinInventory { BinId = identityTest.Source, ProductId = identityTest.Component, LotNumber = "COMPONENT-LOT", Quantity = 3, Status = InventoryStatus.Damaged }); db.Bins.Single(x => x.Id == identityTest.Source).CurrentOccupancy += 3; });
    Check((await Run(Request(identityTest))).IsSuccess, "sole Available row selected by full persisted identity; same-lot held status unchanged");
    await using (var db = Db()) Check((await db.BinInventories.SingleAsync(x => x.ProductId == identityTest.Component && x.Status == InventoryStatus.Damaged)).Quantity == 3, "Damaged stock never converted/consumed");

    foreach (var kind in new[] { "lpn-output", "serial-output", "reserved-output", "expired-output", "ambiguous-output", "output-overflow" })
    {
        var f = await Seed();
        await Change(db =>
        {
            var q = kind == "output-overflow" ? int.MaxValue : 1;
            var output = new BinInventory { BinId = f.Target, ProductId = f.Kit, LotNumber = "OUTPUT", Quantity = q, Status = InventoryStatus.Available };
            if (kind == "lpn-output") output.LpnCode = "OUTPUT-PALLET";
            if (kind == "reserved-output") output.ReservedQuantity = 1;
            if (kind == "expired-output") output.ExpirationDate = DateTime.UtcNow.AddDays(-1);
            db.BinInventories.Add(output); var bin = db.Bins.Single(x => x.Id == f.Target); bin.MaxCapacity = (double)int.MaxValue + 10; bin.CurrentOccupancy = q;
            if (kind == "serial-output") db.ProductSerialNumbers.Add(new() { Id = Guid.NewGuid(), ProductId = f.Kit, BinInventoryId = output.Id, SerialCode = Guid.NewGuid().ToString() });
            if (kind == "ambiguous-output") { db.BinInventories.Add(new BinInventory { BinId = f.Target, ProductId = f.Kit, LotNumber = "OUTPUT-2", Quantity = 1, Status = InventoryStatus.Available }); bin.CurrentOccupancy++; }
        });
        await Reject(f, kind);
    }
    foreach (var kind in new[] { "zero-kit", "negative-kit", "zero-requirement", "negative-requirement", "requirement-overflow", "null-components", "null-component", "empty-component", "empty-bin", "self-component" })
    {
        var f = await Seed(); var request = Request(f);
        switch (kind)
        {
            case "zero-kit": request.AssembleQuantity = 0; break;
            case "negative-kit": request.AssembleQuantity = -1; break;
            case "zero-requirement": request.Components[0].QuantityPerKit = 0; break;
            case "negative-requirement": request.Components[0].QuantityPerKit = -1; break;
            case "requirement-overflow": request.AssembleQuantity = int.MaxValue; break;
            case "null-components": request.Components = null!; break;
            case "null-component": request.Components.Add(null!); break;
            case "empty-component": request.Components[0].ComponentProductId = Guid.Empty; break;
            case "empty-bin": request.Components[0].SourceBinId = Guid.Empty; break;
            case "self-component": request.Components[0].ComponentProductId = f.Kit; break;
        }
        await Reject(f, kind, request);
    }
    var validator = new AssembleKitCommandValidator();
    Check(!validator.Validate(new AssembleKitCommand(new() { KitProductId = Guid.NewGuid(), TargetBinId = Guid.NewGuid(), AssembleQuantity = 1, Components = new() { null! } })).IsValid, "validator handles null component without throwing");

    // Failure after the SQL writes completed, before transaction commit: rollback must restore all tables.
    foreach (var concurrency in new[] { true, false })
    {
        var f = await Seed(); var before = await FixtureDatabase.Snapshot(fixture.Connection);
        await using var db = Db(new FailAfterSave(concurrency));
        bool failed;
        try { failed = !(await Run(Request(f), db)).IsSuccess; }
        catch (InvalidOperationException) when (!concurrency) { failed = true; }
        Check(failed, "post-Save fault " + (concurrency ? "concurrency maps cleanly" : "unexpected propagates"));
        Check(before == await FixtureDatabase.Snapshot(fixture.Connection), "post-Save rollback restores all stock/output/occupancy/ledger/audit/rowversion");
        Check(!db.ChangeTracker.Entries().Any(), "rollback clears failed context for safe reuse");
    }
    var stale = await Seed();
    await using (var cached = Db())
    {
        await cached.BinInventories.LoadAsync(); await cached.Bins.LoadAsync();
        await Change(db => { db.BinInventories.Single(x => x.Id == stale.Stock).Quantity = 3; db.Bins.Single(x => x.Id == stale.Source).CurrentOccupancy = 3; });
        await Reject(stale, "fresh context insufficient after concurrent change");
        var before = await FixtureDatabase.Snapshot(fixture.Connection);
        Check(!(await Run(Request(stale), cached)).IsSuccess && before == await FixtureDatabase.Snapshot(fixture.Connection), "stale tracked context reloads live quantities and preserves DB");
    }

    var race = await Seed(); var racing = Request(race, 6, 1);
    var raceResults = await Task.WhenAll(Run(racing), Run(racing));
    Check(raceResults.Count(x => x.IsSuccess) == 1, "two Kitting requests competing for 10 stock, demand 6 each: one winner");
    await using (var db = Db()) Check((await db.BinInventories.FindAsync(race.Stock))!.Quantity == 4 &&
        (await db.BinInventories.SingleAsync(x => x.ProductId == race.Kit)).Quantity == 6 && await db.InventoryTransactions.CountAsync(x => x.ProductId == race.Kit) == 1, "double consume race has exactly one output and receipt, no automatic retry");

    var destination = await Seed(capacity: 1); var secondSource = await Seed();
    var requestA = Request(destination, 1, 1); var requestB = Request(secondSource, 1, 1); requestB.TargetBinId = destination.Target; requestB.KitProductId = destination.Kit;
    var destinationResults = await Task.WhenAll(Run(requestA), Run(requestB));
    Check(destinationResults.Count(x => x.IsSuccess) == 1, "two sources competing for absent destination row/capacity 1: one winner");
    await using (var db = Db()) Check(await db.BinInventories.CountAsync(x => x.ProductId == destination.Kit) == 1 &&
        (await db.Bins.FindAsync(destination.Target))!.CurrentOccupancy == 1, "destination new-row race no duplicate output identity/capacity overrun");

    var outboundRace = await Seed(); Guid orderId;
    await using (var db = Db())
    {
        var order = new OutboundIssue { BinId = outboundRace.Source, OrderNumber = Guid.NewGuid().ToString() };
        order.Items.Add(new() { Id = Guid.NewGuid(), OrderId = order.Id, ProductId = outboundRace.Component, Quantity = 8, IsDirectPick = true });
        db.OutboundIssues.Add(order); await db.SaveChangesAsync(); orderId = order.Id;
    }
    async Task<Result<bool>> Allocate()
    {
        await using var db = Db(); var mutations = new InventoryMutationCoordinator(db);
        return await new OutboundLifecycle(db, mutations, new OutboundCoordinator(db, mutations), new InboundReceiveCoordinator(db)).AllocateAsync(orderId, null, default);
    }
    var competing = await Task.WhenAll(Run(Request(outboundRace, 6, 1)), Allocate());
    Check(competing.Count(x => x.IsSuccess) == 1, "Kitting vs outbound reservation: one winner, ATP protected");
    await using (var db = Db())
    {
        var stock = await db.BinInventories.FindAsync(outboundRace.Stock);
        Check((stock!.Quantity == 4 && stock.ReservedQuantity == 0) || (stock.Quantity == 10 && stock.ReservedQuantity == 8), "reservation ownership and physical consumption coherent after race");
    }
    // Real SQL lock timeout maps to a conflict, never to a hidden retry.
    var locked = await Seed(); var beforeLock = await FixtureDatabase.Snapshot(fixture.Connection);
    await using (var blocker = Db())
    {
        await using var transaction = await blocker.Database.BeginTransactionAsync();
        await blocker.Database.ExecuteSqlInterpolatedAsync($"UPDATE Bins SET CurrentOccupancy=CurrentOccupancy WHERE Id={locked.Source}");
        await using var contender = Db(); await contender.Database.OpenConnectionAsync(); await contender.Database.ExecuteSqlRawAsync("SET LOCK_TIMEOUT 150");
        var result = await Run(Request(locked), contender);
        Check(!result.IsSuccess && result.Error?.Code == "COM_409", "real SQL1222 lock timeout returns COM_409 without retry");
        await transaction.RollbackAsync();
    }
    Check(beforeLock == await FixtureDatabase.Snapshot(fixture.Connection), "SQL timeout preserves database");
    await Invariants("final focused suite");
}

sealed record F(Guid Source, Guid Target, Guid Component, Guid Kit, Guid Stock, Guid Zone, Guid Warehouse);
sealed class FailAfterSave(bool concurrency) : SaveChangesInterceptor
{
    public override ValueTask<int> SavedChangesAsync(SaveChangesCompletedEventData eventData, int result, CancellationToken cancellationToken = default)
        => throw (concurrency ? new DbUpdateConcurrencyException("K1 test: after SQL Save, before commit") : new InvalidOperationException("K1 test: unexpected post-Save failure"));
}
