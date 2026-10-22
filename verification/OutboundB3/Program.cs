using Microsoft.EntityFrameworkCore.Diagnostics;
using SmartWMS.Application.Features.OutboundOrders;
using SmartWMS.Application.Features.OutboundOrders.DTOs.Commands;
using SmartWMS.Application.Features.OutboundOrders.Commands.CreateOutboundOrder;
using SmartWMS.Infrastructure.Persistence.Repositories;
using SmartWMS.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums;
using SmartWMS.Infrastructure.Persistence.DbContext;

if (args.Length < 2 || args[0] is not ("--schema" or "--focused" or "--http" or "--cached-context")) throw new ArgumentException("<--schema|--focused|--http|--cached-context> <report> [api-dll]");
var report = Path.GetFullPath(args[1]); Directory.CreateDirectory(report);
var results = new List<string>();
void Check(bool ok, string message) { results.Add((ok ? "PASS: " : "FAIL: ") + message); Console.WriteLine(results[^1]); if (!ok) throw new Exception(results[^1]); }
ApplicationDbContext Db(string connection) => new(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(connection).Options, new FixtureUser());
try
{
    if (args[0] == "--schema") await Schema();
    else if (args[0] == "--focused") await Focused();
    else if (args[0] == "--cached-context") await CachedContext();
    else await HttpSmoke.Run(report, args[2], Check);
    Console.WriteLine($"ALL {results.Count} B3 CHECKS PASSED");
}
finally { await File.WriteAllLinesAsync(Path.Combine(report, "results.txt"), results); }

async Task Schema()
{
    await using var fixture = new FixtureDatabase("B3 schema");
    Console.WriteLine("Fixture database: " + fixture.Name);
    await using var db = Db(fixture.Connection);
    await db.Database.MigrateAsync();
    Check((await db.Database.GetAppliedMigrationsAsync()).Count() == 31, "fresh database executes 31 migrations to B3 HEAD");
    Check(!db.Database.HasPendingModelChanges(), "EF snapshot matches model");
    var wh = new Warehouse { Code="W", Name="W" }; var zone = new Zone { Code="Z", Name="Z", Warehouse=wh };
    var bin = new Bin { Code="B", Zone=zone, MaxCapacity=100, CurrentOccupancy=10 };
    var staging = new Bin { Code="S", Zone=zone, MaxCapacity=100, CurrentOccupancy=1, Purpose=BinPurpose.Staging };
    var product = new Product { SKU="P", Barcode="P", Name="P" };
    var stock = new BinInventory { Bin=bin, Product=product, LotNumber="L", Quantity=10, ReservedQuantity=3, Status=InventoryStatus.Available };
    var staged = new BinInventory { Bin=staging, Product=product, LotNumber="L", Quantity=1, Status=InventoryStatus.Available };
    var order = new OutboundIssue { Bin=bin, OrderNumber="STAGED" };
    var line = new OutboundOrderItem { Id=Guid.NewGuid(), OrderId=order.Id, Product=product, Quantity=3 };
    order.Items.Add(line);
    db.OutboundIssues.Add(order); db.BinInventories.AddRange(stock,staged); await db.SaveChangesAsync();
    var allocation = new OutboundAllocation { OrderId=order.Id, SourceBinId=bin.Id, StagingBinId=staging.Id, Generation=1 };
    db.OutboundAllocations.Add(allocation); await db.SaveChangesAsync();
    var reservation = new InventoryReservation { AllocationId=allocation.Id, OrderId=order.Id, OrderItemId=line.Id, SourceBinInventoryId=stock.Id, StagingBinInventoryId=staged.Id, Quantity=3, PickedQuantity=1 };
    db.InventoryReservations.Add(reservation); await db.SaveChangesAsync();
    Check(!allocation.IsDirectPick && !line.IsDirectPick && !reservation.IsDirectPick, "staged path still accepts original topology/progress");
    await Reject(fixture.Connection, async c => { var r=await c.InventoryReservations.SingleAsync(); r.StagingBinInventoryId=null; }, "staged picked reservation still requires staging inventory");
    await Reject(fixture.Connection, async c => { var a=await c.OutboundAllocations.SingleAsync(); a.StagingBinId=null; }, "staged allocation still requires distinct destination");
    await Reject(fixture.Connection, async c => { var l=await c.OutboundOrderItems.SingleAsync(); l.PickedQuantity=1; l.ShippedQuantity=1; }, "staged shipped line cannot bypass staged quantity");
    var direct = new OutboundIssue { BinId=bin.Id, OrderNumber="DIRECT" };
    var dl = new OutboundOrderItem { Id=Guid.NewGuid(), OrderId=direct.Id, ProductId=product.Id, Quantity=2, IsDirectPick=true, PickedQuantity=2, ShippedQuantity=2 };
    direct.Items.Add(dl); db.OutboundIssues.Add(direct); await db.SaveChangesAsync();
    var da = new OutboundAllocation { OrderId=direct.Id, SourceBinId=bin.Id, IsDirectPick=true, Generation=1 };
    db.OutboundAllocations.Add(da); await db.SaveChangesAsync();
    var dr = new InventoryReservation { AllocationId=da.Id, OrderId=direct.Id, OrderItemId=dl.Id, SourceBinInventoryId=stock.Id, Quantity=2, PickedQuantity=2, ShippedQuantity=2, IsDirectPick=true, Status="Shipped" };
    db.InventoryReservations.Add(dr); await db.SaveChangesAsync();
    Check(dl.StagedQuantity==0 && dr.StagingBinInventoryId==null, "direct picked/shipped progress valid without fabricated staging");
    await Reject(fixture.Connection, async c => { var a=await c.OutboundAllocations.SingleAsync(x=>x.IsDirectPick); a.StagingBinId=staging.Id; }, "direct allocation rejects staging bin");
    await Reject(fixture.Connection, async c => { var r=await c.InventoryReservations.SingleAsync(x=>x.IsDirectPick); r.StagingBinInventoryId=staged.Id; }, "direct reservation rejects staging inventory");
    await Reject(fixture.Connection, async c => { var l=await c.OutboundOrderItems.SingleAsync(x=>x.IsDirectPick); l.PickedQuantity=1; }, "direct shipped quantity cannot exceed picked");
    await Reject(fixture.Connection, async c => { var l=await c.OutboundOrderItems.SingleAsync(x=>x.IsDirectPick); l.StagedQuantity=1; }, "direct line cannot fabricate staged progress");
    await Reject(fixture.Connection, async c => { c.InventoryReservations.Add(new InventoryReservation { AllocationId=allocation.Id, OrderId=order.Id, OrderItemId=line.Id, SourceBinInventoryId=staged.Id, Quantity=1, IsDirectPick=true }); await Task.CompletedTask; }, "mode composite FK prevents direct reservation on staged allocation/line");

    await using var upgrade = new FixtureDatabase("30 migration checkpoint upgrade");
    await using var prior = Db(upgrade.Connection);
    var checkpoint = prior.Database.GetMigrations().ElementAt(29);
    await prior.GetService<IMigrator>().MigrateAsync(checkpoint);
    Check((await prior.Database.GetAppliedMigrationsAsync()).Count()==30, "upgrade fixture starts at exact B2 30-migration checkpoint");
    var w=Guid.NewGuid(); var z=Guid.NewGuid(); var b=Guid.NewGuid(); var s=Guid.NewGuid(); var p=Guid.NewGuid();
    var o=Guid.NewGuid(); var l=Guid.NewGuid(); var a=Guid.NewGuid(); var r=Guid.NewGuid(); var st=Guid.NewGuid();
    await prior.Database.ExecuteSqlInterpolatedAsync($"""
        INSERT Warehouses (Id,Code,Name,Address,IsDeleted,CreatedAt,CreatedBy) VALUES ({w},N'OLD-W',N'W',N'',0,SYSUTCDATETIME(),N'fixture');
        INSERT Zones (Id,Code,Name,WarehouseId,IsDeleted,CreatedAt,CreatedBy) VALUES ({z},N'OLD-Z',N'Z',{w},0,SYSUTCDATETIME(),N'fixture');
        INSERT Bins (Id,Code,ZoneId,MaxCapacity,CurrentOccupancy,IsDeleted,CreatedAt,CreatedBy,Purpose) VALUES ({b},N'OLD-B',{z},100,10,0,SYSUTCDATETIME(),N'fixture',0),({s},N'OLD-S',{z},100,0,0,SYSUTCDATETIME(),N'fixture',1);
        INSERT Products (Id,SKU,Barcode,Name,CreatedAt,CreatedBy,IsDeleted,Weight,ABCClass,TrackingMode) VALUES ({p},N'OLD-P',N'OLD-P',N'P',SYSUTCDATETIME(),N'fixture',0,0,N'C',0);
        INSERT BinInventories (Id,BinId,ProductId,LotNumber,Quantity,ReservedQuantity,Status,CreatedAt,CreatedBy) VALUES ({st},{b},{p},N'OLD-L',10,2,1,SYSUTCDATETIME(),N'fixture');
        INSERT OutboundIssues (Id,BinId,OrderNumber,Status,ExpectedShipDate,Priority,Notes,IsDeleted,CreatedAt,CreatedBy) VALUES ({o},{b},N'OLD-O',N'Allocated',SYSUTCDATETIME(),N'Normal',N'',0,SYSUTCDATETIME(),N'fixture');
        INSERT OutboundOrderItems (Id,OrderId,ProductId,Quantity,Status,CreatedAt,ReservedQuantity,PickedQuantity,StagedQuantity,ShippedQuantity) VALUES ({l},{o},{p},2,N'Allocated',SYSUTCDATETIME(),2,0,0,0);
        INSERT OutboundAllocations (Id,OrderId,Generation,IsActive,Status,SourceBinId,StagingBinId,CreatedAt,CreatedBy) VALUES ({a},{o},1,1,N'Active',{b},{s},SYSUTCDATETIME(),N'fixture');
        INSERT InventoryReservations (Id,AllocationId,OrderId,OrderItemId,SourceBinInventoryId,Quantity,PickedQuantity,ShippedQuantity,ReleasedQuantity,Status,CreatedAt,CreatedBy) VALUES ({r},{a},{o},{l},{st},2,0,0,0,N'Active',SYSUTCDATETIME(),N'fixture');
        """);
    // Snapshot contains only schema/data/history; migration does not reinterpret any preexisting rows.
    await prior.Database.MigrateAsync();
    Check((await prior.Database.GetAppliedMigrationsAsync()).Count()==31 && !(await prior.Database.GetPendingMigrationsAsync()).Any(), "B2 checkpoint upgrades to B3 without rewriting historical migrations");
    var legacyReservation=await prior.InventoryReservations.SingleAsync();
    Check(!legacyReservation.IsDirectPick && legacyReservation.Quantity==2 && legacyReservation.SourceBinInventoryId==st &&
        legacyReservation.SourceLotNumber==null && !(await prior.OutboundOrderItems.SingleAsync()).IsDirectPick &&
        !(await prior.OutboundAllocations.SingleAsync()).IsDirectPick && (await prior.BinInventories.SingleAsync()).ReservedQuantity==2,
        "existing staged rows remain staged with identity/counters unchanged during forward migration");
    var before = await FixtureDatabase.Snapshot(upgrade.Connection);
    await prior.Database.MigrateAsync();
    Check(before==await FixtureDatabase.Snapshot(upgrade.Connection), "already deployed B3 rerun has no mutation");
}
async Task Reject(string connection, Func<ApplicationDbContext,Task> mutate, string message)
{
    var before = await FixtureDatabase.Snapshot(connection);
    await using var db=Db(connection);
    await mutate(db);
    try { await db.SaveChangesAsync(); throw new Exception("Expected SQL547: "+message); }
    catch (Exception ex) when (FixtureDatabase.Sql(ex)?.Number==547) { Check(true,message); }
    Check(before==await FixtureDatabase.Snapshot(connection), message+" rejection rolls back data/audit");
}

OutboundLifecycle Lifecycle(ApplicationDbContext db)
{
    var mutations = new InventoryMutationCoordinator(db);
    return new(db, mutations, new OutboundCoordinator(db, mutations), new InboundReceiveCoordinator(db));
}
async Task CachedContext()
{
    await using var fixture=new FixtureDatabase("B3 stale tracked order items");
    await using var db=Db(fixture.Connection);await db.Database.MigrateAsync();
    var wh=new Warehouse {Code="W",Name="W"};var zone=new Zone {Code="Z",Name="Z",Warehouse=wh};
    var bin=new Bin {Id=Guid.NewGuid(),Code="B",Zone=zone,MaxCapacity=100};
    var product=new Product {SKU="P",Barcode="P",Name="P"};
    var order=new OutboundIssue {Bin=bin,OrderNumber="CACHED"};
    order.Items.Add(new OutboundOrderItem {Id=Guid.NewGuid(),OrderId=order.Id,Product=product,Quantity=1,IsDirectPick=true});
    db.OutboundIssues.Add(order);await db.SaveChangesAsync();
    // DELETE initially reads a tracked graph; another Pending update can replace its lines
    // before the lifecycle acquires the header update lock.
    await using(var writer=Db(fixture.Connection))
    {
        writer.OutboundOrderItems.RemoveRange(await writer.OutboundOrderItems.Where(x=>x.OrderId==order.Id).ToListAsync());
        writer.OutboundOrderItems.Add(new OutboundOrderItem {Id=Guid.NewGuid(),OrderId=order.Id,ProductId=product.Id,Quantity=1,IsDirectPick=true});
        await writer.SaveChangesAsync();
    }
    var before=await FixtureDatabase.Snapshot(fixture.Connection);
    var result=await Lifecycle(db).CancelAsync(order.Id,default);
    Console.WriteLine("Cached replacement evidence: "+result.Error?.Code);
    Check(!result.IsSuccess && result.Error?.Code=="COM_409","stale tracked line replacement returns documented concurrency conflict");
    Check(before==await FixtureDatabase.Snapshot(fixture.Connection),"stale cancellation conflict rolls back header/line/audit with no partial mutation");
    // The API contract requires reload after a conflict; it does not promise transparent retry.
    await using(var fresh=Db(fixture.Connection)) Check((await Lifecycle(fresh).CancelAsync(order.Id,default)).IsSuccess,"explicit reload/resubmit can cancel current Pending lines");
    await using var verify=Db(fixture.Connection);
    Check((await verify.OutboundIssues.SingleAsync()).Status=="Cancelled" && (await verify.OutboundOrderItems.SingleAsync()).Status=="Cancelled", "cancel changes only current persisted line/header after replacement");
    Check(!await verify.InventoryReservations.AnyAsync() && !await verify.InventoryTransactions.AnyAsync(),"cached Pending cancel still has no inventory/reservation side effect");
}
async Task Focused()
{
    await using var fixture=new FixtureDatabase("B3 focused");
    Console.WriteLine("Fixture database: "+fixture.Name);
    await using (var setup=Db(fixture.Connection)) await setup.Database.MigrateAsync();
    async Task<F> Seed(ProductTrackingMode mode=ProductTrackingMode.None, int quantity=10, int reserve=0, int demand=6)
    {
        await using var db=Db(fixture.Connection);
        var tag=Guid.NewGuid().ToString("N");
        var wh=new Warehouse { Code=tag, Name=tag };
        var zone=new Zone { Code=tag, Name=tag, Warehouse=wh };
        var bin=new Bin { Id=Guid.NewGuid(), Code=tag, Zone=zone, MaxCapacity=1000, CurrentOccupancy=quantity };
        var product=new Product { SKU=tag, Barcode=tag, Name=tag, TrackingMode=mode };
        var row=new BinInventory { Bin=bin, Product=product, Quantity=quantity, ReservedQuantity=reserve, LotNumber="LOT-A", ExpirationDate=DateTime.UtcNow.Date.AddDays(100), Status=InventoryStatus.Available };
        db.BinInventories.Add(row); await db.SaveChangesAsync();
        var order=await new CreateOutboundOrderCommandHandler(new UnitOfWork(db),db).Handle(new(new CreateOutboundOrderRequest { OrderNumber=tag, BinId=bin.Id, ExpectedShipDate=DateTime.UtcNow.Date.AddDays(1),
            Items=new(){new(){ProductId=product.Id,RequestedQuantity=demand}} }),default);
        Check(order.IsSuccess,"create active "+mode+" order");
        return new(order.Data,bin.Id,row.Id,product.Id,wh.Id,zone.Id,quantity,reserve,demand);
    }
    async Task<SmartWMS.Application.Common.Models.Result<bool>> Act(F f, string action, DirectPickRequest? input=null)
    {
        await using var db=Db(fixture.Connection); var svc=Lifecycle(db);
        return action switch { "allocate"=>await svc.AllocateAsync(f.Order,null,default), "pick"=>await svc.PickAsync(f.Order,input??await Payload(f),default),
            "pack"=>await svc.PackAsync(f.Order,default), "ship"=>await svc.ShipAsync(f.Order,default), "cancel"=>await svc.CancelAsync(f.Order,default), _=>throw new Exception() };
    }
    async Task<DirectPickRequest> Payload(F f)
    {
        await using var db=Db(fixture.Connection);
        return new(){ Items=await db.InventoryReservations.Where(x=>x.OrderId==f.Order).Select(x=>new DirectPickItemRequest {ReservationId=x.Id,Quantity=x.Quantity}).ToListAsync() };
    }
    async Task UnchangedFailure(F f,string action,string message,DirectPickRequest? input=null, string code="COM_409")
    {
        var before=await FixtureDatabase.Snapshot(fixture.Connection);
        var result=await Act(f,action,input);
        Check(!result.IsSuccess && result.Error?.Code==code,message+" returns "+code);
        Check(before==await FixtureDatabase.Snapshot(fixture.Connection),message+" no data/stock/progress/ledger/audit mutation");
    }
    foreach (var mode in new[]{ProductTrackingMode.None,ProductTrackingMode.Lot})
    {
        var f=await Seed(mode);
        await UnchangedFailure(f,"pack","pack before Picked");
        await UnchangedFailure(f,"ship","ship before Packed");
        Check((await Act(f,"allocate")).IsSuccess,mode+" allocation persisted");
        await using (var db=Db(fixture.Connection))
        {
            var row=await db.BinInventories.SingleAsync(x=>x.Id==f.Stock);
            var line=await db.OutboundOrderItems.SingleAsync(x=>x.OrderId==f.Order);
            Check(row.Quantity==10 && row.ReservedQuantity==6 && line.ReservedQuantity==6 && line.TrackingModeSnapshot==mode,"allocation reserves ATP without physical deduction");
            Check(await db.OutboundAllocations.CountAsync(x=>x.OrderId==f.Order && x.IsActive && x.IsDirectPick)==1 && await db.InventoryReservations.CountAsync(x=>x.OrderId==f.Order && x.Quantity==6)==1,"allocation/reservation links persisted once");
        }
        await UnchangedFailure(f,"allocate","duplicate allocation");
        var bad=await Payload(f); bad.Items[0].Quantity++;
        await UnchangedFailure(f,"pick","over-pick",bad);
        var duplicate=await Payload(f); duplicate.Items.Add(duplicate.Items[0]);
        await UnchangedFailure(f,"pick","duplicate reservation IDs",duplicate,"VAL_1000");
        Check((await Act(f,"pick")).IsSuccess,mode+" pick succeeds");
        await using(var db=Db(fixture.Connection))
        {
            var row=await db.BinInventories.SingleAsync(x=>x.Id==f.Stock);
            var bin=await db.Bins.SingleAsync(x=>x.Id==f.Bin);
            var r=await db.InventoryReservations.SingleAsync(x=>x.OrderId==f.Order);
            Check(row.Quantity==4 && row.ReservedQuantity==0 && bin.CurrentOccupancy==4 && r.PickedQuantity==6 && r.StagingBinInventoryId==null,"pick deducts physical/reserved/occupancy once, no fake staging");
            var ledger=await db.InventoryTransactions.SingleAsync(x=>x.InventoryReservationId==r.Id && x.TransactionType=="OUTBOUND");
            Check(ledger.QuantityChanged==-6 && ledger.BinInventoryId==row.Id && ledger.OutboundOrderItemId==r.OrderItemId,"physical OUTBOUND ledger exact reservation/stock/line identity");
        }
        await UnchangedFailure(f,"pick","duplicate pick");
        await UnchangedFailure(f,"cancel","Picked cancellation unsupported");
        await UnchangedFailure(f,"ship","ship after pick but before pack");
        Check((await Act(f,"pack")).IsSuccess,"Picked -> Packed");
        var packed=await FixtureDatabase.Snapshot(fixture.Connection);
        Check((await Act(f,"pack")).IsSuccess && packed==await FixtureDatabase.Snapshot(fixture.Connection),"duplicate pack is evidence-checked no-op");
        await UnchangedFailure(f,"cancel","Packed cancellation unsupported");
        Check((await Act(f,"ship")).IsSuccess,"Packed -> Shipped");
        var shipped=await FixtureDatabase.Snapshot(fixture.Connection);
        Check((await Act(f,"ship")).IsSuccess && shipped==await FixtureDatabase.Snapshot(fixture.Connection),"duplicate ship no physical/history/audit effect");
        await using(var db=Db(fixture.Connection))
        {
            var row=await db.BinInventories.SingleAsync(x=>x.Id==f.Stock);
            var line=await db.OutboundOrderItems.SingleAsync(x=>x.OrderId==f.Order);
            var r=await db.InventoryReservations.SingleAsync(x=>x.OrderId==f.Order);
            Check(row.Quantity==4 && row.ReservedQuantity==0 && line.PickedQuantity==6 && line.ShippedQuantity==6 && line.StagedQuantity==0 && r.ShippedQuantity==6 && r.Status=="Shipped","final physical/progress consistent, no second deduction");
            Check(await db.InventoryTransactions.Where(x=>x.OutboundOrderItemId==line.Id && x.TransactionType=="OUTBOUND").SumAsync(x=>(long)x.QuantityChanged)==-6 &&
                await db.InventoryTransactions.CountAsync(x=>x.OutboundOrderItemId==line.Id && x.TransactionType=="SHIP_CONFIRM")==1,"ledger has one physical pick and one zero-delta ship confirmation");
        }
    }
    var shortage=await Seed(reserve:5);
    await UnchangedFailure(shortage,"allocate","insufficient ATP excludes existing reservation");
    var split=await Seed(ProductTrackingMode.Lot,quantity:3,demand:6);
    await using(var db=Db(fixture.Connection))
    {
        db.BinInventories.Add(new BinInventory {BinId=split.Bin,ProductId=split.Product,Quantity=4,LotNumber="LOT-B",ExpirationDate=DateTime.UtcNow.AddDays(200),Status=InventoryStatus.Available});
        (await db.Bins.SingleAsync(x=>x.Id==split.Bin)).CurrentOccupancy+=4; await db.SaveChangesAsync();
    }
    Check((await Act(split,"allocate")).IsSuccess,"FEFO allocation splits exact identities across lots in source bin");
    await using(var db=Db(fixture.Connection)) Check(await db.InventoryReservations.CountAsync(x=>x.OrderId==split.Order)==2 &&
        await db.BinInventories.Where(x=>x.BinId==split.Bin).SumAsync(x=>x.ReservedQuantity)==6,"two source lots have separate reservations and counter sum=6 before pick");
    var splitPick = await Act(split,"pick");
    if (!splitPick.IsSuccess)
    {
        await using var evidence=Db(fixture.Connection);
        Console.WriteLine("Split pick error: "+splitPick.Error?.Message);
        foreach (var r in await evidence.InventoryReservations.Where(x=>x.OrderId==split.Order).ToListAsync())
        {
            var row=await evidence.BinInventories.SingleAsync(x=>x.Id==r.SourceBinInventoryId);
            Console.WriteLine($"Split identity stock={row.Id} lot={row.LotNumber}/{r.SourceLotNumber} expiry={row.ExpirationDate:O}/{r.SourceExpirationDate:O} q={row.Quantity} reserved={row.ReservedQuantity} demand={r.Quantity}");
        }
    }
    Check(splitPick.IsSuccess,"quantity pick consumes both lot reservations atomically: "+splitPick.Error?.Message);
    await using(var db=Db(fixture.Connection)) Check(await db.BinInventories.Where(x=>x.BinId==split.Bin).SumAsync(x=>x.Quantity)==1 &&
        (await db.Bins.SingleAsync(x=>x.Id==split.Bin)).CurrentOccupancy==1,"split-lot pick exact final physical/occupancy");
    var batch=await Seed();
    await using(var db=Db(fixture.Connection))
    {
        // Either line order reserves six first, then the second line must fail on ATP=4.
        db.OutboundOrderItems.Add(new OutboundOrderItem {Id=Guid.NewGuid(),OrderId=batch.Order,ProductId=batch.Product,Quantity=6,IsDirectPick=true});
        await db.SaveChangesAsync();
    }
    await UnchangedFailure(batch,"allocate","full-order shortage rolls back earlier line reservations");
    var outside=await Seed(quantity:2,demand:6);
    await using(var db=Db(fixture.Connection))
    {
        var otherBin=new Bin {Id=Guid.NewGuid(),Code=Guid.NewGuid().ToString("N"),ZoneId=outside.Zone,MaxCapacity=100,CurrentOccupancy=10};
        db.BinInventories.Add(new BinInventory {Bin=otherBin,ProductId=outside.Product,Quantity=10,LotNumber="OUTSIDE",Status=InventoryStatus.Available});
        await db.SaveChangesAsync();
    }
    await UnchangedFailure(outside,"allocate","B3 single-bin scope does not silently allocate another bin");
    var repeatedProduct=await Seed(demand:3);
    await using(var db=Db(fixture.Connection))
    {
        db.OutboundOrderItems.Add(new OutboundOrderItem {Id=Guid.NewGuid(),OrderId=repeatedProduct.Order,ProductId=repeatedProduct.Product,Quantity=3,IsDirectPick=true});
        await db.SaveChangesAsync();
    }
    Check((await Act(repeatedProduct,"allocate")).IsSuccess,"two lines of same product allocate without refreshing away prior counters");
    await using(var db=Db(fixture.Connection)) Check((await db.BinInventories.SingleAsync(x=>x.Id==repeatedProduct.Stock)).ReservedQuantity==6 &&
        await db.InventoryReservations.CountAsync(x=>x.OrderId==repeatedProduct.Order)==2,"duplicate product lines retain both reservations/counters");
    Check((await Act(repeatedProduct,"pick")).IsSuccess,"duplicate product lines pick correct persisted total");
    foreach(var status in new[]{InventoryStatus.Reserved,InventoryStatus.QCHold,InventoryStatus.Damaged,InventoryStatus.Expired})
    {
        var f=await Seed();
        await using(var db=Db(fixture.Connection)) { var row=await db.BinInventories.SingleAsync(x=>x.Id==f.Stock); row.Status=status; await db.SaveChangesAsync(); }
        await UnchangedFailure(f,"allocate","exclude "+status);
    }
    foreach(var kind in new[]{"expired-date","lpn","deleted-bin","deleted-zone","deleted-warehouse"})
    {
        var f=await Seed();
        await using(var db=Db(fixture.Connection))
        {
            if(kind=="deleted-bin") (await db.Bins.SingleAsync(x=>x.Id==f.Bin)).IsDeleted=true;
            else if(kind=="deleted-zone") (await db.Zones.SingleAsync(x=>x.Id==f.Zone)).IsDeleted=true;
            else if(kind=="deleted-warehouse") (await db.Warehouses.SingleAsync(x=>x.Id==f.Warehouse)).IsDeleted=true;
            else {var row=await db.BinInventories.SingleAsync(x=>x.Id==f.Stock); if(kind=="lpn") row.LpnCode="PALLET"; else row.ExpirationDate=DateTime.UtcNow.AddDays(-1);}
            await db.SaveChangesAsync();
        }
        await UnchangedFailure(f,"allocate","reject "+kind);
    }
    foreach(var change in new[]{"mode","lot","expiry","status","counter"})
    {
        var f=await Seed(ProductTrackingMode.Lot); Check((await Act(f,"allocate")).IsSuccess,"stale fixture allocated");
        await using(var db=Db(fixture.Connection))
        {
            var row=await db.BinInventories.SingleAsync(x=>x.Id==f.Stock);
            if(change=="mode") (await db.Products.SingleAsync(x=>x.Id==f.Product)).TrackingMode=ProductTrackingMode.Serial;
            if(change=="lot") row.LotNumber="CHANGED";
            if(change=="expiry") row.ExpirationDate=row.ExpirationDate!.Value.AddDays(1);
            if(change=="status") row.Status=InventoryStatus.QCHold;
            if(change=="counter") row.ReservedQuantity=0;
            await db.SaveChangesAsync();
        }
        await UnchangedFailure(f,"pick","stale allocation "+change);
    }
    var cancelled=await Seed(reserve:2,demand:6);
    Check((await Act(cancelled,"allocate")).IsSuccess,"cancel fixture allocated");
    Check((await Act(cancelled,"cancel")).IsSuccess,"Allocated cancellation releases reservation");
    await using(var db=Db(fixture.Connection))
    {
        var row=await db.BinInventories.SingleAsync(x=>x.Id==cancelled.Stock);
        var r=await db.InventoryReservations.SingleAsync(x=>x.OrderId==cancelled.Order);
        Check(row.Quantity==10 && row.ReservedQuantity==2 && (await db.Bins.SingleAsync(x=>x.Id==cancelled.Bin)).CurrentOccupancy==10 &&
            r.ReleasedQuantity==6 && r.Status=="Released" && !(await db.OutboundAllocations.SingleAsync(x=>x.OrderId==cancelled.Order)).IsActive,"cancel preserves other reservations and physical stock/occupancy");
    }
    var pending=await Seed(); Check((await Act(pending,"cancel")).IsSuccess,"Pending cancel succeeds without inventory effect");
    await using(var db=Db(fixture.Connection)) Check(!await db.InventoryReservations.AnyAsync(x=>x.OrderId==pending.Order) && (await db.BinInventories.SingleAsync(x=>x.Id==pending.Stock)).Quantity==10,"Pending cancel creates no reservation/physical mutation");

    var race=await Seed(demand:6);
    Guid other;
    await using(var db=Db(fixture.Connection))
    {
        var o=await new CreateOutboundOrderCommandHandler(new UnitOfWork(db),db).Handle(new(new(){OrderNumber=Guid.NewGuid().ToString("N"),BinId=race.Bin,ExpectedShipDate=DateTime.UtcNow.AddDays(1),Items=new(){new(){ProductId=race.Product,RequestedQuantity=6}}}),default);
        other=o.Data;
    }
    var start=new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
    async Task<SmartWMS.Application.Common.Models.Result<bool>> Concurrent(Guid id) { await start.Task; await using var db=Db(fixture.Connection); return await Lifecycle(db).AllocateAsync(id,null,default); }
    var t1=Concurrent(race.Order); var t2=Concurrent(other); start.SetResult();
    var outcomes=await Task.WhenAll(t1,t2);
    Check(outcomes.Count(x=>x.IsSuccess)==1 && outcomes.Single(x=>!x.IsSuccess).Error?.Code=="COM_409","two orders concurrent allocation: one winner, one conflict");
    await using(var db=Db(fixture.Connection)) Check((await db.BinInventories.SingleAsync(x=>x.Id==race.Stock)).ReservedQuantity==6 && await db.InventoryReservations.Where(x=>x.SourceBinInventoryId==race.Stock).SumAsync(x=>x.Quantity)==6,"concurrent allocation cannot oversubscribe ATP");
    var dupe=await Seed();
    var d1=Act(dupe,"allocate"); var d2=Act(dupe,"allocate"); var duplicateResults=await Task.WhenAll(d1,d2);
    Check(duplicateResults.Count(x=>x.IsSuccess)==1 && duplicateResults.Single(x=>!x.IsSuccess).Error?.Code=="COM_409","concurrent duplicate allocation same order one winner");
    var inventoryRace=await Seed();
    async Task<SmartWMS.Application.Common.Models.Result<bool>> Adjust(F f)
    {
        await using var db=Db(fixture.Connection);
        return await new SmartWMS.Application.Features.InventoryManagement.Commands.AdjustStock.AdjustStockCommandHandler(db,new InventoryMutationCoordinator(db))
            .Handle(new(new(){BinId=f.Bin,ProductId=f.Product,LotNumber="LOT-A",AdjustmentQuantity=-6,ReasonCode="B3_RACE"}),default);
    }
    var inventoryOutcomes=await Task.WhenAll(Act(inventoryRace,"allocate"),Adjust(inventoryRace));
    Check(inventoryOutcomes.Count(x=>x.IsSuccess)==1,"allocate vs adjustment: only one can consume ATP");
    await using(var db=Db(fixture.Connection))
    {
        var row=await db.BinInventories.SingleAsync(x=>x.Id==inventoryRace.Stock);
        Check((row.Quantity==10 && row.ReservedQuantity==6)||(row.Quantity==4 && row.ReservedQuantity==0),"allocation/adjustment race preserves physical/reservation invariants");
    }
    var statusFixture=await Seed();Check((await Act(statusFixture,"allocate")).IsSuccess,"status guard fixture allocated");
    var beforeStatus=await FixtureDatabase.Snapshot(fixture.Connection);
    await using(var db=Db(fixture.Connection))
    {
        var result=await new SmartWMS.Application.Features.InventoryManagement.Commands.ChangeStockStatus.ChangeStockStatusCommandHandler(db,new InventoryMutationCoordinator(db),null!,Microsoft.Extensions.Logging.Abstractions.NullLogger<SmartWMS.Application.Features.InventoryManagement.Commands.ChangeStockStatus.ChangeStockStatusCommandHandler>.Instance)
            .Handle(new(new(){BinId=statusFixture.Bin,ProductId=statusFixture.Product,LotNumber="LOT-A",NewStatus=InventoryStatus.Damaged,ReasonCode="B3_GUARD"}),default);
        Check(!result.IsSuccess && result.Error?.Code=="COM_409","existing status-change cannot hold/damage actively reserved direct-pick stock");
    }
    Check(beforeStatus==await FixtureDatabase.Snapshot(fixture.Connection),"status-change conflict leaves B3 reservations/stock/history/audit unchanged");
    await using(var db=Db(fixture.Connection))
    {
        var serial=await new SmartWMS.Application.Features.OutboundOrders.Commands.PickWithSerial.PickWithSerialCommandHandler(db).Handle(new(new(){OrderId=statusFixture.Order,ProductId=statusFixture.Product,BinId=statusFixture.Bin,ScannedSerials=new(){"UNSUPPORTED"}}),default);
        Check(!serial.IsSuccess && serial.Error?.Code=="COM_409","legacy serial endpoint cannot bypass B3 reservation lifecycle");
        var wave=await new SmartWMS.Application.Features.OutboundOrders.Commands.CreateWavePickTask.CreateWavePickTaskCommandHandler(new UnitOfWork(db)).Handle(new(new(){OutboundOrderIds=new(){statusFixture.Order}}),default);
        Check(!wave.IsSuccess && wave.Error?.Code=="COM_409","legacy wave endpoint cannot mutate direct-pick order state");
    }

    var timeout=await Seed();var timeoutBefore=await FixtureDatabase.Snapshot(fixture.Connection);
    await using(var holder=new Microsoft.Data.SqlClient.SqlConnection(fixture.Connection))
    {
        await holder.OpenAsync();await using var tx=(Microsoft.Data.SqlClient.SqlTransaction)await holder.BeginTransactionAsync();
        await using var command=holder.CreateCommand();command.Transaction=tx;command.CommandText="SELECT Id FROM Bins WITH (UPDLOCK,HOLDLOCK) WHERE Id=@id";command.Parameters.AddWithValue("@id",timeout.Bin);await command.ExecuteScalarAsync();
        await using var db=Db(fixture.Connection);
        var mutations=new InventoryMutationCoordinator(db);
        var probe=new LockTimeoutProbe(new OutboundCoordinator(db,mutations));
        await db.Database.OpenConnectionAsync();await db.Database.ExecuteSqlRawAsync("SET LOCK_TIMEOUT 500");
        var result=await new OutboundLifecycle(db,mutations,probe,new InboundReceiveCoordinator(db)).AllocateAsync(timeout.Order,null,default);
        Console.WriteLine($"Lock evidence: code={result.Error?.Code}, timeouts={probe.Timeouts}");
        Check(!result.IsSuccess && result.Error?.Code=="COM_409" && probe.Timeouts==1,"actual SQL1222 lock timeout maps to COM_409 without retry");
        await tx.RollbackAsync();
    }
    Check(timeoutBefore==await FixtureDatabase.Snapshot(fixture.Connection),"lock conflict leaves no partial allocation/reservation/audit/ledger");

    var fault=await Seed();
    var faultBefore=await FixtureDatabase.Snapshot(fixture.Connection);
    await using(var db=new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(fixture.Connection).AddInterceptors(new AfterSaveFault()).Options,new FixtureUser()))
    {
        try { await Lifecycle(db).AllocateAsync(fault.Order,null,default); throw new Exception("Expected injected fault"); }
        catch(InjectedFault) { Check(!db.ChangeTracker.Entries().Any(),"post-save allocation fault rolls back/clears tracker"); }
    }
    Check(faultBefore==await FixtureDatabase.Snapshot(fixture.Connection),"allocation save fault no stock/reservation/history/audit partial commit");
    Check((await Act(fault,"allocate")).IsSuccess,"retry after rolled-back allocation succeeds");
    var pickBefore=await FixtureDatabase.Snapshot(fixture.Connection);
    await using(var db=new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(fixture.Connection).AddInterceptors(new AfterSaveFault()).Options,new FixtureUser()))
    {
        try { await Lifecycle(db).PickAsync(fault.Order,await Payload(fault),default); throw new Exception("Expected injected fault"); }
        catch(InjectedFault) { Check(!db.ChangeTracker.Entries().Any(),"post-save pick fault clears tracker"); }
    }
    Check(pickBefore==await FixtureDatabase.Snapshot(fixture.Connection),"pick save fault rolls back physical/reserved/occupancy/history/audit/order");
    Check((await Act(fault,"pick")).IsSuccess && (await Act(fault,"pack")).IsSuccess,"rolled-back pick can be explicitly resubmitted then packed");
    var shipBefore=await FixtureDatabase.Snapshot(fixture.Connection);
    await using(var db=new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(fixture.Connection).AddInterceptors(new AfterSaveFault()).Options,new FixtureUser()))
    {
        try {await Lifecycle(db).ShipAsync(fault.Order,default);throw new Exception("Expected injected fault");}
        catch(InjectedFault) {Check(!db.ChangeTracker.Entries().Any(),"post-save ship fault clears tracked state");}
    }
    Check(shipBefore==await FixtureDatabase.Snapshot(fixture.Connection),"ship rollback keeps order Packed and no partial history/audit/progress");
    await using(var db=Db(fixture.Connection)) Check(!await db.BinInventories.AnyAsync(x=>x.Quantity<0 || x.ReservedQuantity<0 || x.ReservedQuantity>x.Quantity),"global fixture invariant: no negative stock/reservation or reserved greater than physical");
}

record F(Guid Order,Guid Bin,Guid Stock,Guid Product,Guid Warehouse,Guid Zone,int Physical,int Reserved,int Demand);
sealed class InjectedFault : Exception {}
sealed class AfterSaveFault : SaveChangesInterceptor
{
    public override ValueTask<int> SavedChangesAsync(SaveChangesCompletedEventData eventData,int result,CancellationToken cancellationToken=default) => throw new InjectedFault();
}
// SQL errors can surface during reader materialization, after CommandExecuted. Observe the
// exception boundary used by the actual conflict mapping, not only CommandFailed callbacks.
sealed class LockTimeoutProbe(SmartWMS.Application.Common.Interfaces.IOutboundCoordinator inner) : SmartWMS.Application.Common.Interfaces.IOutboundCoordinator
{
    public int Timeouts;
    public Task<OutboundIssue?> LockOrderAsync(Guid id,CancellationToken ct)=>inner.LockOrderAsync(id,ct);
    public Task<List<OutboundAllocation>> LockAllocationsAsync(Guid id,CancellationToken ct)=>inner.LockAllocationsAsync(id,ct);
    public Task<List<InventoryReservation>> LockReservationsAsync(Guid id,CancellationToken ct)=>inner.LockReservationsAsync(id,ct);
    public Task<List<BinInventory>> LockStocksAsync(Guid id,CancellationToken ct)=>inner.LockStocksAsync(id,ct);
    public bool IsConflict(Exception ex) {if(FixtureDatabase.Sql(ex)?.Number==1222) Interlocked.Increment(ref Timeouts);return inner.IsConflict(ex);}
}
