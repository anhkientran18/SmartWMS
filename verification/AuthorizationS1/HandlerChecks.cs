using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Features.CycleCounting.Commands.ConfirmCycleCount;
using SmartWMS.Application.Features.CycleCounting.Commands.CreateCountSheet;
using SmartWMS.Application.Features.CycleCounting.DTOs.Commands;
using SmartWMS.Application.Features.CycleCounting.DTOs.Queries;
using SmartWMS.Application.Features.CycleCounting.Queries.GetCountSheetById;
using SmartWMS.Infrastructure.Persistence.DbContext;
using SmartWMS.Infrastructure.Persistence.Repositories;
using SmartWMS.Infrastructure.Services;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums;

static class HandlerChecks
{
    // Pre-commit check: constructor/ownership only, no HTTP host or AI provider.
    public static async Task Smoke(Action<bool,string> check)
    {
        await using var fixture=new FixtureDatabase("S1 pre-commit ownership only; no provider/HTTP/full regression");
        var staff=Guid.NewGuid();var bin=Guid.NewGuid();
        await using(var db=new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(fixture.Connection).Options,new FixtureUser()))
        {
            await db.Database.MigrateAsync();
            check(!db.Database.HasPendingModelChanges()&&(await db.Database.GetAppliedMigrationsAsync()).Count()==31,"ownership fixture uses existing31 migrations/model unchanged");
            db.Users.Add(new User{Id=staff,Username="s1-ownership",Email="s1-ownership@example.invalid",Role="Staff",IsActive=true});
            var warehouse=new Warehouse{Code="S1_OWN_W",Name="S1 ownership"};
            var zone=new Zone{Code="S1_OWN_Z",Name="S1 ownership",Warehouse=warehouse};
            var location=new Bin{Id=bin,Code="S1_OWN_BIN",Zone=zone,CurrentOccupancy=10,MaxCapacity=100};
            var product=new Product{SKU="S1_OWN_SKU",Barcode="S1_OWN_BAR",Name="S1 ownership",TrackingMode=ProductTrackingMode.None};
            db.BinInventories.Add(new BinInventory{Bin=location,Product=product,Quantity=10,LotNumber="LOT-DEFAULT",Status=InventoryStatus.Available});
            await db.SaveChangesAsync();
        }
        await Run(fixture.Connection,bin,staff,check);
    }

    sealed record Actor(string? UserId,string? Role) : ICurrentUserService { public string IpAddress=>"127.0.0.1"; }
    public static async Task Run(string connection,Guid bin,Guid staff,Action<bool,string> check)
    {
        ApplicationDbContext Db(ICurrentUserService actor)=>new(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(connection).Options,actor);
        var manager=new Actor(Guid.NewGuid().ToString(),"WarehouseManager");
        Guid sheetId;
        await using(var db=Db(manager))
        {
            var result=await new CreateCountSheetCommandHandler(db,new InventoryMutationCoordinator(db),new CycleCountCoordinator(db)).Handle(new(new CreateCountSheetRequest{BinId=bin,AssignedUserId=staff}),default);
            check(result.IsSuccess,"direct ownership fixture created");sheetId=result.Data;
        }
        foreach(var actor in new[]{new Actor("not-a-guid","Staff"),new Actor(Guid.Empty.ToString(),"Staff"),new Actor(staff.ToString(),"Other"),new Actor(null,null),new Actor(Guid.NewGuid().ToString(),"Staff")})
        {
            var before=await FixtureDatabase.Snapshot(connection);
            await using(var db=Db(actor))
            {
                var detail=await new GetCountSheetByIdQueryHandler(new UnitOfWork(db),actor).Handle(new(new CountSheetByIdRequest{Id=sheetId}),default);
                check(!detail.IsSuccess&&detail.Error?.Code=="AUTH_403","handler detail fails closed on invalid identity/role/non-owner");
                var sheet=await db.CycleCountSheets.AsNoTracking().Include(x=>x.Items).SingleAsync(x=>x.Id==sheetId);
                var request=new ConfirmCycleCountRequest{CountSheetId=sheetId,CountedItems=sheet.Items.Select(x=>new CycleCountItemRequest{ItemId=x.Id,CountedQuantity=x.SystemQuantity}).ToList()};
                var result=await new ConfirmCycleCountCommandHandler(db,new InventoryMutationCoordinator(db),new CycleCountCoordinator(db),actor).Handle(new(request),default);
                check(!result.IsSuccess&&result.Error?.Code=="AUTH_403","handler confirm fails closed on invalid identity/role/non-owner");
                check(db.Database.CurrentTransaction==null&&!db.ChangeTracker.Entries().Any(),"ownership denial disposes transaction and clears tracking");
            }
            check(before==await FixtureDatabase.Snapshot(connection),"direct denied handler entire SQL/ledger/audit unchanged");
        }
        var own=new Actor(staff.ToString(),"Staff");
        await using(var db=Db(own))
        {
            var tracked=await db.CycleCountSheets.Include(x=>x.Items).SingleAsync(x=>x.Id==sheetId);
            await using(var other=Db(manager)) { var s=await other.CycleCountSheets.SingleAsync(x=>x.Id==sheetId);s.AssignedUserId=null;await other.SaveChangesAsync(); }
            var before=await FixtureDatabase.Snapshot(connection);
            var result=await new ConfirmCycleCountCommandHandler(db,new InventoryMutationCoordinator(db),new CycleCountCoordinator(db),own).Handle(new(new ConfirmCycleCountRequest{CountSheetId=sheetId,CountedItems=tracked.Items.Select(x=>new CycleCountItemRequest{ItemId=x.Id,CountedQuantity=x.SystemQuantity+1}).ToList()}),default);
            check(!result.IsSuccess&&result.Error?.Code=="AUTH_403","locked assignment reload defeats pretracked old ownership after reassignment");
            check(before==await FixtureDatabase.Snapshot(connection),"stale ownership rejection no SQL/ledger/audit mutation");
        }
    }
}
