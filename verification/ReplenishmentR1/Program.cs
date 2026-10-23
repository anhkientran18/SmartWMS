using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InventoryManagement.Commands.AutoReplenish;
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
    Console.WriteLine($"ALL {results.Count} R1 CHECKS PASSED");
}
finally { await File.WriteAllLinesAsync(Path.Combine(report, "results.txt"), results); }

async Task Focused()
{
    await using var fixture = new FixtureDatabase("R1 SQL relational fixture; no shared DB access");
    Console.WriteLine("Fixture database: " + fixture.Name);
    ApplicationDbContext Db(params IInterceptor[] interceptors) => new(new DbContextOptionsBuilder<ApplicationDbContext>()
        .UseSqlServer(fixture.Connection).AddInterceptors(interceptors).Options, new FixtureUser());
    await using (var db = Db())
    {
        await db.Database.MigrateAsync();
        Check((await db.Database.GetAppliedMigrationsAsync()).Count() == 31, "existing 31 migrations create isolated SQL fixture");
        Check(!db.Database.HasPendingModelChanges(), "R1 needs no migration; model matches B3/K1 snapshot");
    }
    var expiry = DateTime.UtcNow.Date.AddDays(100);
    async Task<F> Seed(int sourceQuantity = 100, int reserved = 0, int targetQuantity = 1, double capacity = 10, bool retainActive = false)
    {
        await using var db = Db();
        // Retire previous scenarios in this generated fixture; never hide mutation failures:
        // each scenario has already asserted its own complete snapshot/invariants before this reset.
        if (!retainActive) foreach (var bin in await db.Bins.ToListAsync()) bin.IsDeleted = true;
        var tag = Guid.NewGuid().ToString("N"); var wh = new Warehouse { Code = tag, Name = tag };
        var zone = new Zone { Code = tag, Name = tag, Warehouse = wh };
        var source = new Bin { Id = Guid.NewGuid(), Code = "S" + tag, Zone = zone, MaxCapacity = Math.Max(100, sourceQuantity), CurrentOccupancy = sourceQuantity };
        var target = new Bin { Id = Guid.NewGuid(), Code = "T" + tag, Zone = zone, MaxCapacity = capacity, CurrentOccupancy = targetQuantity };
        var product = new Product { SKU = tag, Barcode = tag, Name = "Product", TrackingMode = ProductTrackingMode.Lot };
        var stock = new BinInventory { Bin = source, Product = product, LotNumber = "LOT-R1", ExpirationDate = expiry, Quantity = sourceQuantity,
            ReservedQuantity = reserved, Status = InventoryStatus.Available };
        var destination = new BinInventory { Bin = target, Product = product, LotNumber = "LOT-R1", ExpirationDate = expiry, Quantity = targetQuantity, Status = InventoryStatus.Available };
        db.BinInventories.AddRange(stock, destination); await db.SaveChangesAsync();
        return new(source.Id, target.Id, stock.Id, destination.Id, product.Id, zone.Id, wh.Id);
    }
    async Task Change(Action<ApplicationDbContext> action) { await using var db = Db(); action(db); await db.SaveChangesAsync(); }
    async Task<Result<int>> Run(ApplicationDbContext? supplied = null)
    {
        var db = supplied ?? Db();
        try { return await new AutoReplenishCommandHandler(db, new InventoryMutationCoordinator(db), new InboundReceiveCoordinator(db),
            new OutboundCoordinator(db, new InventoryMutationCoordinator(db))).Handle(new(), default); }
        finally { if (supplied == null) await db.DisposeAsync(); }
    }
    async Task Skip(string label)
    {
        var before = await FixtureDatabase.Snapshot(fixture.Connection); var result = await Run();
        Check(result.IsSuccess && result.Data == 0, label + " returns success0 (deterministic skip contract)");
        Check(before == await FixtureDatabase.Snapshot(fixture.Connection), label + " complete DB snapshot unchanged: stock/version/occupancy/ledger/audit");
    }
    async Task Invariants(string label)
    {
        await using var db = Db(); var bins = await db.Bins.ToListAsync();
        var totals = await db.BinInventories.GroupBy(x => x.BinId).Select(g => new { Id = g.Key, Q = g.Sum(x => (long)x.Quantity) }).ToDictionaryAsync(x => x.Id, x => x.Q);
        Check(!await db.BinInventories.AnyAsync(x => x.Quantity < 0 || x.ReservedQuantity < 0 || x.ReservedQuantity > x.Quantity), label + " no negative/invalid stock or reservation");
        Check(bins.All(x => x.CurrentOccupancy == totals.GetValueOrDefault(x.Id) && x.CurrentOccupancy >= 0 && x.CurrentOccupancy <= x.MaxCapacity), label + " physical sum = occupancy, capacity respected");
    }

    var happy = await Seed(reserved: 20); long beforeTotal;
    await using (var db = Db()) beforeTotal = await db.BinInventories.SumAsync(x => (long)x.Quantity);
    var happyResult = await Run(); Check(happyResult.IsSuccess && happyResult.Data == 1, "happy path: one quantity movement, not a task ID");
    await using (var db = Db())
    {
        var s = await db.BinInventories.FindAsync(happy.Stock); var t = await db.BinInventories.FindAsync(happy.Destination);
        Check(s!.Quantity == 91 && s.ReservedQuantity == 20 && t!.Quantity == 10, "source -9, target +9, reserved ownership unchanged");
        Check(s.LotNumber == "LOT-R1" && t!.LotNumber == s.LotNumber && s.ExpirationDate == expiry && t.ExpirationDate == expiry, "lot and nullable expiry preserved exactly");
        Check((await db.Bins.FindAsync(happy.Source))!.CurrentOccupancy == 91 && (await db.Bins.FindAsync(happy.Target))!.CurrentOccupancy == 10, "source/destination occupancy and exact capacity boundary");
        Check(await db.BinInventories.SumAsync(x => (long)x.Quantity) == beforeTotal, "total physical quantity conserved");
        var ledger = await db.InventoryTransactions.SingleAsync();
        Check(ledger.TransactionType == "TRANSFER" && ledger.QuantityChanged == 9 && ledger.BinInventoryId == s.Id && ledger.DestinationBinInventoryId == t!.Id, "one positive transfer ledger with exact source/destination inventory IDs");
        Check(ledger.SourceBinCode == (await db.Bins.FindAsync(happy.Source))!.Code && ledger.DestinationBinCode == (await db.Bins.FindAsync(happy.Target))!.Code &&
            ledger.ReasonCode.StartsWith("AUTO_REPLENISHMENT:") && ledger.ReasonCode.EndsWith(":LOT:LOT-R1"), "ledger actual locations, operation correlation and lot");
        Check(await db.AuditLogs.AnyAsync(x => x.TableName == "InventoryTransactions" && x.Type == "C") && await db.AuditLogs.AnyAsync(x => x.TableName == "BinInventories" && x.Type == "U"), "DbContext audit pipeline intact");
    }
    await Invariants("happy path"); await Skip("repeat after success rechecks full target, no duplicate ledger");
    var exact = await Seed(sourceQuantity: 12, reserved: 3);
    Check((await Run()).Data == 1, "source ATP == required is allowed, including reserved-only remainder");
    await using (var db = Db()) Check((await db.BinInventories.FindAsync(exact.Stock))!.Quantity == 3 &&
        (await db.BinInventories.FindAsync(exact.Stock))!.ReservedQuantity == 3, "exact ATP never consumes reserved stock");
    await Skip("exact-ATP reserved-only remainder cannot trigger reverse refill");
    var drained = await Seed(sourceQuantity: 9); Check((await Run()).Data == 1, "exact physical quantity transfers and retains zero source row");
    await using (var db = Db()) Check((await db.BinInventories.FindAsync(drained.Stock))!.Quantity == 0 && (await db.Bins.FindAsync(drained.Source))!.CurrentOccupancy == 0, "exact drain no negative source occupancy");
    await Skip("empty donor cannot become a reverse-refill target");
    await Seed(sourceQuantity: 12, reserved: 4); await Skip("physical sufficient but ATP insufficient");
    await Seed(sourceQuantity: 8); await Skip("no implicit partial movement from insufficient single source");
    await Seed(sourceQuantity: 10); await Skip("donor residual would become a new low usable target: skip ping-pong risk");
    await Seed(targetQuantity: 0); await Skip("empty target excluded by existing positive-row contract, no destination create");
    await Seed(targetQuantity: 3); await Skip("above 20 percent threshold excluded");
    var threshold = await Seed(targetQuantity: 2); Check((await Run()).Data == 1, "exact 20 percent target threshold included");
    var fractional = await Seed(capacity: 10.75); Check((await Run()).Data == 1, "existing floor capacity semantics retained, no fractional physical units");
    await using (var db = Db()) Check((await db.Bins.FindAsync(fractional.Target))!.CurrentOccupancy == 10, "floor needed=9 leaves fractional free space safely");

    foreach (var kind in new[] { "source-hold", "source-damaged", "source-expired-status", "source-reserved-status", "target-hold", "target-damaged", "target-expired-status", "different-lot", "expiry-conflict", "source-expired", "both-expired", "source-lpn", "target-lpn", "serial-mode", "source-serial", "target-serial", "deleted-source", "deleted-target", "deleted-zone", "deleted-warehouse", "deleted-product", "source-staging", "target-staging", "cross-warehouse", "source-drift", "target-drift", "ambiguous-source", "ambiguous-target", "blank-lot", "target-reserved", "output-overflow" })
    {
        var f = await Seed();
        await Change(db =>
        {
            var s = db.BinInventories.Single(x => x.Id == f.Stock); var t = db.BinInventories.Single(x => x.Id == f.Destination);
            switch (kind)
            {
                case "source-hold": s.Status = InventoryStatus.QCHold; break;
                case "source-damaged": s.Status = InventoryStatus.Damaged; break;
                case "source-expired-status": s.Status = InventoryStatus.Expired; break;
                case "source-reserved-status": s.Status = InventoryStatus.Reserved; break;
                case "target-hold": t.Status = InventoryStatus.QCHold; break;
                case "target-damaged": t.Status = InventoryStatus.Damaged; break;
                case "target-expired-status": t.Status = InventoryStatus.Expired; break;
                case "different-lot": s.LotNumber = "OTHER-LOT"; break;
                case "expiry-conflict": s.ExpirationDate = expiry.AddDays(1); break;
                case "source-expired": s.ExpirationDate = DateTime.UtcNow.AddDays(-1); break;
                case "both-expired": s.ExpirationDate = t.ExpirationDate = DateTime.UtcNow.AddDays(-1); break;
                case "source-lpn": s.LpnCode = "PALLET"; break;
                case "target-lpn": t.LpnCode = "PALLET"; break;
                case "serial-mode": db.Products.Single(x => x.Id == f.Product).TrackingMode = ProductTrackingMode.Serial; break;
                case "source-serial": db.ProductSerialNumbers.Add(new() { Id = Guid.NewGuid(), ProductId = f.Product, BinInventoryId = f.Stock, SerialCode = Guid.NewGuid().ToString() }); break;
                case "target-serial": db.ProductSerialNumbers.Add(new() { Id = Guid.NewGuid(), ProductId = f.Product, BinInventoryId = f.Destination, SerialCode = Guid.NewGuid().ToString() }); break;
                case "deleted-source": db.Bins.Single(x => x.Id == f.Source).IsDeleted = true; break;
                case "deleted-target": db.Bins.Single(x => x.Id == f.Target).IsDeleted = true; break;
                case "deleted-zone": db.Zones.Single(x => x.Id == f.Zone).IsDeleted = true; break;
                case "deleted-warehouse": db.Warehouses.Single(x => x.Id == f.Warehouse).IsDeleted = true; break;
                case "deleted-product": db.Products.Single(x => x.Id == f.Product).IsDeleted = true; break;
                case "source-staging": db.Bins.Single(x => x.Id == f.Source).Purpose = BinPurpose.Staging; break;
                case "target-staging": db.Bins.Single(x => x.Id == f.Target).Purpose = BinPurpose.Staging; break;
                case "cross-warehouse": var wh = new Warehouse { Code = Guid.NewGuid().ToString(), Name = "Other" }; var z = new Zone { Code = Guid.NewGuid().ToString(), Name = "Other", Warehouse = wh }; db.Zones.Add(z); db.Bins.Single(x => x.Id == f.Source).Zone = z; break;
                case "source-drift": db.Bins.Single(x => x.Id == f.Source).CurrentOccupancy--; break;
                case "target-drift": db.Bins.Single(x => x.Id == f.Target).CurrentOccupancy++; break;
                case "ambiguous-source": db.BinInventories.Add(new BinInventory { BinId = f.Source, ProductId = f.Product, LotNumber = "\tLOT-R1\t", Quantity = 1, Status = InventoryStatus.Available, ExpirationDate = expiry }); db.Bins.Single(x => x.Id == f.Source).MaxCapacity++; db.Bins.Single(x => x.Id == f.Source).CurrentOccupancy++; break;
                case "ambiguous-target": db.BinInventories.Add(new BinInventory { BinId = f.Target, ProductId = f.Product, LotNumber = "\tLOT-R1\t", Quantity = 1, Status = InventoryStatus.Available, ExpirationDate = expiry }); db.Bins.Single(x => x.Id == f.Target).CurrentOccupancy++; break;
                case "blank-lot": s.LotNumber = t.LotNumber = " "; break;
                case "target-reserved": t.ReservedQuantity = 1; break;
                case "output-overflow": t.Quantity = int.MaxValue; var bin = db.Bins.Single(x => x.Id == f.Target); bin.MaxCapacity = (double)int.MaxValue * 10; bin.CurrentOccupancy = int.MaxValue; s.Quantity = int.MaxValue; var sb = db.Bins.Single(x => x.Id == f.Source); sb.CurrentOccupancy = int.MaxValue; sb.MaxCapacity = int.MaxValue; break;
            }
        });
        await Skip(kind);
        if (kind == "source-drift") await Change(db => db.Bins.Single(x => x.Id == f.Source).CurrentOccupancy++);
        if (kind == "target-drift") await Change(db => db.Bins.Single(x => x.Id == f.Target).CurrentOccupancy--);
    }
    var noExpiry = await Seed(); await Change(db => { db.BinInventories.Single(x => x.Id == noExpiry.Stock).ExpirationDate = null; db.BinInventories.Single(x => x.Id == noExpiry.Destination).ExpirationDate = null; });
    Check((await Run()).Data == 1, "nullable expiry matches and remains null");
    var normalized = await Seed(); await Change(db => { db.BinInventories.Single(x => x.Id == normalized.Stock).LotNumber = " LOT-R1 "; });
    Check((await Run()).Data == 1, "single normalized lot identity accepted using shared collation-aware policy");
    await using (var db = Db()) Check((await db.BinInventories.FindAsync(normalized.Stock))!.LotNumber == " LOT-R1 " &&
        (await db.BinInventories.FindAsync(normalized.Destination))!.LotNumber == "LOT-R1", "movement never overwrites original lot metadata");

    var identities = await Seed();
    await Change(db =>
    {
        db.BinInventories.Single(x => x.Id == identities.Stock).Quantity = 50;
        db.BinInventories.Add(new BinInventory { BinId = identities.Source, ProductId = identities.Product, LotNumber = "OTHER-LOT", Quantity = 50, Status = InventoryStatus.Available, ExpirationDate = expiry });
        db.BinInventories.Add(new BinInventory { BinId = identities.Target, ProductId = identities.Product, LotNumber = "LOT-R1", Quantity = 1, Status = InventoryStatus.Damaged, ExpirationDate = expiry });
        db.Bins.Single(x => x.Id == identities.Target).CurrentOccupancy++;
    });
    Check((await Run()).Data == 1, "multiple literal lots/statuses: match exact usable lot/status, never First by product");
    await using (var db = Db()) Check((await db.BinInventories.FindAsync(identities.Stock))!.Quantity == 42 &&
        (await db.BinInventories.SingleAsync(x => x.BinId == identities.Source && x.LotNumber == "OTHER-LOT")).Quantity == 50 &&
        (await db.BinInventories.SingleAsync(x => x.BinId == identities.Target && x.Status == InventoryStatus.Damaged)).Quantity == 1,
        "unrelated lot and same-lot Damaged destination remain unchanged");
    var crossZone = await Seed();
    await Change(db => { var zone = new Zone { Code = Guid.NewGuid().ToString(), Name = "Same warehouse", WarehouseId = crossZone.Warehouse }; db.Zones.Add(zone); db.Bins.Single(x => x.Id == crossZone.Target).Zone = zone; });
    Check((await Run()).Data == 1, "cross-zone within one warehouse remains allowed");
    var noLot = await Seed();
    await Change(db => { db.Products.Single(x => x.Id == noLot.Product).TrackingMode = ProductTrackingMode.None; db.BinInventories.Single(x => x.Id == noLot.Stock).LotNumber = ""; db.BinInventories.Single(x => x.Id == noLot.Destination).LotNumber = ""; });
    Check((await Run()).Data == 1, "None mode without lot metadata supported; no auto-generated lot rewrite");
    var bad = await Seed(); await Change(db => db.BinInventories.Single(x => x.Id == bad.Stock).LpnCode = "PALLET");
    var good = await Seed(retainActive: true);
    Check((await Run()).Data == 1, "invalid LPN candidate skipped while independent valid candidate commits in same batch");
    await using (var db = Db()) Check((await db.BinInventories.FindAsync(bad.Stock))!.Quantity == 100 &&
        (await db.BinInventories.FindAsync(bad.Destination))!.Quantity == 1 && !await db.InventoryTransactions.AnyAsync(x => x.ProductId == bad.Product), "skipped LPN candidate has no physical mutation or ledger");

    var multi = await Seed(); Guid secondTarget, secondDestination;
    await using (var db = Db())
    {
        var bin = new Bin { Id = Guid.NewGuid(), Code = Guid.NewGuid().ToString(), ZoneId = multi.Zone, MaxCapacity = 10, CurrentOccupancy = 1 };
        var row = new BinInventory { Bin = bin, ProductId = multi.Product, LotNumber = "LOT-R1", ExpirationDate = expiry, Quantity = 1, Status = InventoryStatus.Available };
        db.BinInventories.Add(row); await db.SaveChangesAsync(); secondTarget = bin.Id; secondDestination = row.Id;
    }
    Check((await Run()).Data == 2, "one batch can fill two targets from same source with projected ATP/occupancy");
    await using (var db = Db())
    {
        Check((await db.BinInventories.FindAsync(multi.Stock))!.Quantity == 82 && (await db.BinInventories.FindAsync(secondDestination))!.Quantity == 10,
            "shared source decremented exactly 18, no physical unit moved twice");
        var ledger = await db.InventoryTransactions.Where(x => x.ProductId == multi.Product).ToListAsync();
        Check(ledger.Count == 2 && ledger.Select(x => x.ReasonCode.Split(":LOT:")[0]).Distinct().Count() == 1, "multi-movement batch shares operation correlation");
    }
    await Skip("batch repeated after success has no new eligible target");

    var capacity = await Seed(targetQuantity: 5, capacity: 100); Guid otherProduct = Guid.NewGuid();
    await Change(db =>
    {
        db.Products.Add(new Product { Id = otherProduct, SKU = otherProduct.ToString(), Barcode = otherProduct.ToString(), Name = "Other lot row" });
        db.BinInventories.Add(new BinInventory { BinId = capacity.Target, ProductId = otherProduct, LotNumber = "SECOND", Quantity = 5, Status = InventoryStatus.Available });
        db.Bins.Single(x => x.Id == capacity.Target).CurrentOccupancy += 5;
        var donor = new Bin { Id = Guid.NewGuid(), Code = Guid.NewGuid().ToString(), ZoneId = capacity.Zone, MaxCapacity = 100, CurrentOccupancy = 100 };
        db.BinInventories.Add(new BinInventory { Bin = donor, ProductId = otherProduct, LotNumber = "SECOND", Quantity = 100, Status = InventoryStatus.Available });
    });
    // Both sources must remain usable after refill; make each exact-physical source drain to zero.
    await Change(db => { var s = db.BinInventories.Single(x => x.Id == capacity.Stock); s.Quantity = 90; db.Bins.Single(x => x.Id == capacity.Source).CurrentOccupancy = 90;
        var s2 = db.BinInventories.Single(x => x.ProductId == otherProduct && x.BinId != capacity.Target); s2.Quantity = 90; db.Bins.Single(x => x.Id == s2.BinId).CurrentOccupancy = 90; });
    Check((await Run()).Data == 1, "two candidate product rows share destination: projected capacity permits only one full refill");
    await using (var db = Db()) Check((await db.Bins.FindAsync(capacity.Target))!.CurrentOccupancy == 100 && await db.InventoryTransactions.CountAsync(x => x.DestinationBinCode == db.Bins.Single(b => b.Id == capacity.Target).Code) == 1, "batch target capacity not oversubscribed, no ledger for skipped row");
    await Skip("capacity-filled target not replenished again and donor not reversed");

    var choices = await Seed(); Guid alternativeStock; Guid chosen;
    await using (var db = Db())
    {
        var bin = new Bin { Id = Guid.NewGuid(), Code = Guid.NewGuid().ToString(), ZoneId = choices.Zone, MaxCapacity = 100, CurrentOccupancy = 100 };
        var stock = new BinInventory { Bin = bin, ProductId = choices.Product, LotNumber = "LOT-R1", ExpirationDate = expiry, Quantity = 100, Status = InventoryStatus.Available };
        db.BinInventories.Add(stock); await db.SaveChangesAsync(); alternativeStock = stock.Id;
        chosen = new[] { (Bin: choices.Source, Stock: choices.Stock), (Bin: bin.Id, Stock: stock.Id) }.OrderBy(x => x.Bin).ThenBy(x => x.Stock).First().Stock;
    }
    Check((await Run()).Data == 1, "multiple safe sources: deterministic BinId/stockId selection");
    await using (var db = Db()) Check((await db.InventoryTransactions.SingleAsync(x => x.ProductId == choices.Product)).BinInventoryId == chosen &&
        (await db.BinInventories.FindAsync(chosen == choices.Stock ? alternativeStock : choices.Stock))!.Quantity == 100, "only deterministic chosen identity consumed, no FEFO invented");

    foreach (var concurrency in new[] { true, false })
    {
        var f = await Seed();
        await Change(db => { var target = new Bin { Id = Guid.NewGuid(), Code = Guid.NewGuid().ToString(), ZoneId = f.Zone, MaxCapacity = 10, CurrentOccupancy = 1 };
            db.BinInventories.Add(new BinInventory { Bin = target, ProductId = f.Product, LotNumber = "LOT-R1", Quantity = 1, ExpirationDate = expiry, Status = InventoryStatus.Available }); });
        var before = await FixtureDatabase.Snapshot(fixture.Connection); await using var db = Db(new FailAfterSave(concurrency)); bool failed;
        try { failed = !(await Run(db)).IsSuccess; } catch (InvalidOperationException) when (!concurrency) { failed = true; }
        Check(failed, "post-SQL fault " + (concurrency ? "maps concurrency to business failure" : "propagates unexpected failure"));
        Check(before == await FixtureDatabase.Snapshot(fixture.Connection), "post-SQL rollback restores source/target/occupancy/ledger/audit/rowversion for whole batch");
        Check(!db.ChangeTracker.Entries().Any(), "failed transaction clears tracked state");
    }
    var cached = await Seed();
    await using (var db = Db())
    {
        await db.BinInventories.LoadAsync(); await db.Bins.LoadAsync();
        await Change(other => { other.BinInventories.Single(x => x.Id == cached.Stock).ReservedQuantity = 95; });
        var before = await FixtureDatabase.Snapshot(fixture.Connection); var result = await Run(db);
        Check(result.IsSuccess && result.Data == 0 && before == await FixtureDatabase.Snapshot(fixture.Connection), "cached context reloads latest reservation/ATP; stale tracked candidates never mutate");
    }

    var overlap = await Seed(); var pause = new PauseBeforeSave(); var attempted = new LockAttempt();
    await using (var first = Db(pause))
    await using (var second = Db(attempted))
    {
        var a = Run(first); await pause.Entered.Task.WaitAsync(TimeSpan.FromSeconds(15));
        var b = Run(second);
        try { await attempted.Entered.Task.WaitAsync(TimeSpan.FromSeconds(15)); }
        finally { pause.Release.TrySetResult(); }
        var outcomes = await Task.WhenAll(a, b);
        Check(outcomes.All(x => x.IsSuccess) && outcomes.Sum(x => x.Data) == 1 && outcomes[1].Data == 0, "overlapping background-style/manual execution: second locks/rechecks old target list, no duplicate refill");
    }
    await using (var db = Db()) Check(await db.InventoryTransactions.CountAsync(x => x.ProductId == overlap.Product) == 1 &&
        (await db.BinInventories.FindAsync(overlap.Destination))!.Quantity == 10, "destination update/capacity race has exactly one ledger and one refill");
    await Skip("repeat after overlapping executions remains no-op");

    var sourceRace = await Seed(sourceQuantity: 9);
    await Change(db => { var target = new Bin { Id = Guid.NewGuid(), Code = Guid.NewGuid().ToString(), ZoneId = sourceRace.Zone, MaxCapacity = 10, CurrentOccupancy = 1 };
        db.BinInventories.Add(new BinInventory { Bin = target, ProductId = sourceRace.Product, LotNumber = "LOT-R1", ExpirationDate = expiry, Quantity = 1, Status = InventoryStatus.Available }); });
    var races = await Task.WhenAll(Run(), Run());
    Check(races.All(x => x.IsSuccess) && races.Sum(x => x.Data) == 1, "two executions, two targets, one exact source: only one movement total");
    await using (var db = Db()) Check((await db.BinInventories.FindAsync(sourceRace.Stock))!.Quantity == 0 &&
        await db.InventoryTransactions.CountAsync(x => x.ProductId == sourceRace.Product) == 1, "same-source race no double consumption/ledger");

    var outbound = await Seed(sourceQuantity: 100); Guid orderId;
    await using (var db = Db())
    {
        var order = new OutboundIssue { BinId = outbound.Source, OrderNumber = Guid.NewGuid().ToString() };
        order.Items.Add(new() { Id = Guid.NewGuid(), OrderId = order.Id, ProductId = outbound.Product, Quantity = 95, IsDirectPick = true });
        db.OutboundIssues.Add(order); await db.SaveChangesAsync(); orderId = order.Id;
    }
    async Task<Result<bool>> Allocate(ApplicationDbContext db)
    { var mutations = new InventoryMutationCoordinator(db); return await new OutboundLifecycle(db, mutations, new OutboundCoordinator(db, mutations), new InboundReceiveCoordinator(db)).AllocateAsync(orderId, null, default); }
    var outboundPause = new PauseBeforeSave(); var replenishAttempt = new LockAttempt();
    await using (var first = Db(outboundPause))
    await using (var second = Db(replenishAttempt))
    {
        var a = Allocate(first); await outboundPause.Entered.Task.WaitAsync(TimeSpan.FromSeconds(15)); var b = Run(second);
        try { await replenishAttempt.Entered.Task.WaitAsync(TimeSpan.FromSeconds(15)); } finally { outboundPause.Release.TrySetResult(); }
        Check((await a).IsSuccess && (await b).IsSuccess && (await b).Data == 0, "outbound allocation vs replenishment: live reserved ATP rechecked after lock wait");
    }
    await using (var db = Db()) Check((await db.BinInventories.FindAsync(outbound.Stock))!.Quantity == 100 &&
        (await db.BinInventories.FindAsync(outbound.Stock))!.ReservedQuantity == 95 && !await db.InventoryTransactions.AnyAsync(x => x.TransactionType == "TRANSFER" && x.ProductId == outbound.Product), "outbound reservation owner preserved, no skipped movement ledger");

    var locked = await Seed(); var beforeLock = await FixtureDatabase.Snapshot(fixture.Connection);
    await using (var blocker = Db())
    {
        await using var tx = await blocker.Database.BeginTransactionAsync();
        await blocker.Database.ExecuteSqlInterpolatedAsync($"SELECT * FROM Bins WITH (UPDLOCK,HOLDLOCK) WHERE Id={locked.Target}");
        await using var contender = Db(); await contender.Database.OpenConnectionAsync(); await contender.Database.ExecuteSqlRawAsync("SET LOCK_TIMEOUT 150");
        var result = await Run(contender); Check(!result.IsSuccess && result.Error?.Code == "COM_409", "real SQL1222 conflict maps cleanly, never blind retries");
        await tx.RollbackAsync();
    }
    Check(beforeLock == await FixtureDatabase.Snapshot(fixture.Connection), "SQL timeout whole DB snapshot unchanged");
    await Invariants("final suite");
}

sealed record F(Guid Source, Guid Target, Guid Stock, Guid Destination, Guid Product, Guid Zone, Guid Warehouse);
sealed class FailAfterSave(bool concurrency) : SaveChangesInterceptor
{
    public override ValueTask<int> SavedChangesAsync(SaveChangesCompletedEventData eventData, int result, CancellationToken cancellationToken = default)
        => throw (concurrency ? new DbUpdateConcurrencyException("R1 fixture after SQL writes before commit") : new InvalidOperationException("R1 fixture unexpected post-SQL fault"));
}
sealed class PauseBeforeSave : SaveChangesInterceptor
{
    public TaskCompletionSource Entered { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
    public TaskCompletionSource Release { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
    public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
    { Entered.TrySetResult(); await Release.Task.WaitAsync(TimeSpan.FromSeconds(20), cancellationToken); return result; }
}
sealed class LockAttempt : DbCommandInterceptor
{
    public TaskCompletionSource Entered { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
    public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
    { if (command.CommandText.Contains("[Bins]") && command.CommandText.Contains("UPDLOCK")) Entered.TrySetResult(); return ValueTask.FromResult(result); }
}
