using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums;
using SmartWMS.Infrastructure.Persistence.DbContext;
using SmartWMS.Infrastructure.Services;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Features.InventoryTransfers.Commands.CreateInventoryTransfer;
using SmartWMS.Application.Features.InventoryTransfers.DTOs.Commands;

static class HttpChecks
{
    public static async Task Run(string report,string api,Action<bool,string> check)
    {
        await using var fixture=new FixtureDatabase("H2 HTTP contracts; isolated SQL and explicit loopback provider");
        ApplicationDbContext Db()=>new(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(fixture.Connection).Options,new FixtureUser());
        var password=Convert.ToHexString(RandomNumberGenerator.GetBytes(20));
        var staff=Guid.NewGuid();var other=Guid.NewGuid();var inactive=Guid.NewGuid();
        var source=Guid.NewGuid();var destination=Guid.NewGuid();var foreign=Guid.NewGuid();var product=Guid.NewGuid();
        await using(var db=Db())
        {
            await db.Database.MigrateAsync();
            check((await db.Database.GetAppliedMigrationsAsync()).Count()==31&&!db.Database.HasPendingModelChanges(),"existing31 migrations; no model/schema change");
            foreach(var role in new[]{"Admin","WarehouseManager","Staff"})db.Users.Add(new User{Id=role=="Staff"?staff:Guid.NewGuid(),Username="f1-"+role,FirstName=role,LastName="H2",Role=role,Email=role+"@example.invalid",PasswordHash=new PasswordHasher().HashPassword(password),IsActive=true});
            db.Users.AddRange(new User{Id=other,Username="h2-other-staff",FirstName="Other",LastName="H2",Role="Staff",IsActive=true,PasswordHash="not-a-login"},new User{Id=inactive,Username="h2-inactive",Role="Staff",IsActive=false,PasswordHash="not-a-login"},new User{Username="h2-unknown-role",Role="Unknown",IsActive=true,PasswordHash="not-a-login"});
            var w=new Warehouse{Code="H2_W",Name="H2"};var w2=new Warehouse{Code="H2_FOREIGN",Name="Other"};
            var z=new Zone{Code="H2_Z",Name="Dry",Warehouse=w};var z2=new Zone{Code="H2_Z2",Name="Other zone same warehouse",Warehouse=w};var z3=new Zone{Code="H2_Z3",Name="Foreign zone",Warehouse=w2};
            var b=new Bin{Id=source,Code="H2_SOURCE",Zone=z,MaxCapacity=100,CurrentOccupancy=20};
            db.Bins.AddRange(b,new Bin{Id=destination,Code="H2_DEST",Zone=z2,MaxCapacity=100},new Bin{Id=foreign,Code="H2_FOREIGN",Zone=z3,MaxCapacity=100});
            var p=new Product{Id=product,SKU="H2_MAIN",Barcode="H2_BARCODE",Name="H2 product",Unit="Pcs",Weight=321.5,DescriptionEmbeddingJson=JsonSerializer.Serialize(DeterministicProvider.Vector())};
            db.BinInventories.Add(new BinInventory{Bin=b,Product=p,Quantity=20,Status=InventoryStatus.Available,LotNumber="LOT-DEFAULT"});
            await db.SaveChangesAsync();
        }
        using var provider=new DeterministicProvider();
        await using var host=await TestHost.Boot(api,fixture.Connection,provider.Url,Path.Combine(report,"host"));
        var tokens=new Dictionary<string,string>();foreach(var role in new[]{"Admin","WarehouseManager","Staff"})tokens[role]=await host.Login(role,password);
        void Actor(string role)=>host.Http.DefaultRequestHeaders.Authorization=role=="Anonymous"?null:new AuthenticationHeaderValue("Bearer",tokens[role]);
        var records=new List<object>();
        async Task<JsonElement> Send(string role,string method,string path,object? body,int expected,bool unchanged=false)
        {
            Actor(role);var before=unchanged?await FixtureDatabase.Snapshot(fixture.Connection):"";var calls=provider.Observed.Count;
            using var request=new HttpRequestMessage(new HttpMethod(method),path);if(body!=null)request.Content=JsonContent.Create(body);
            using var response=await host.Http.SendAsync(request);var text=await response.Content.ReadAsStringAsync();
            check((int)response.StatusCode==expected,$"HTTP {role} {method} {path} expected{expected} actual{(int)response.StatusCode}");
            records.Add(new{role,method,path,expected,status=(int)response.StatusCode});
            if(unchanged){check(before==await FixtureDatabase.Snapshot(fixture.Connection),"ALL SQL/schema/stock/occupancy/ledger/audit unchanged "+role+" "+path);check(calls==provider.Observed.Count,"zero provider calls "+path);}
            if(expected!=200)return default;
            using var j=JsonDocument.Parse(text);check(j.RootElement.GetProperty("isSuccess").GetBoolean(),"Result success "+path);return j.RootElement.Clone();
        }
        const string prefix="/api/v1/";
        foreach(var role in new[]{"Admin","WarehouseManager","Staff","Anonymous"})
        {
            var j=await Send(role,"GET",prefix+"CycleCounting/assignees",null,role=="Staff"?403:role=="Anonymous"?401:200,true);
            if(role is "Admin" or "WarehouseManager")
            {
                var rows=j.GetProperty("data").EnumerateArray().ToArray();
                check(rows.Length==2&&rows.Select(x=>x.GetProperty("id").GetGuid()).ToHashSet().SetEquals(new[]{staff,other}),"assignees only active Staff; excludes inactive/Admin/WM/unknown");
                check(rows.All(x=>x.EnumerateObject().Select(p=>p.Name).ToHashSet().SetEquals(new[]{"id","username","fullName"})),"minimal assignee DTO exactly3 fields; no password/email/role");
                check(rows.Single(x=>x.GetProperty("id").GetGuid()==staff).GetProperty("fullName").GetString()=="H2 Staff","assignee fullName matches User semantics");
            }
        }
        await Send("WarehouseManager","GET",prefix+"Users/list",null,403,true);
        // Exercise WM lookup -> assignment -> Staff own count, without a manual GUID contract.
        var lookup=await Send("WarehouseManager","GET",prefix+"CycleCounting/assignees",null,200,true);
        var assigned=lookup.GetProperty("data").EnumerateArray().Single(x=>x.GetProperty("username").GetString()=="f1-Staff").GetProperty("id").GetGuid();
        async Task<Guid> Sheet(Guid? assignee)
        {var j=await Send("WarehouseManager","POST",prefix+"CycleCounting/create-sheet",new{requestData=new{binId=source,assignedUserId=assignee}},200);return j.GetProperty("data").GetGuid();}
        async Task Confirm(string role,Guid id,int expected,bool unchanged=false)
        {
            await using var db=Db();var rows=await db.CycleCountItems.Where(x=>x.CountSheetId==id).ToListAsync();
            await Send(role,"POST",prefix+"CycleCounting/confirm",new{countSheetId=id,countedItems=rows.Select(x=>new{itemId=x.Id,countedQuantity=x.SystemQuantity}).ToArray()},expected,unchanged);
        }
        var own=await Sheet(assigned);await Send("Staff","GET",prefix+"CycleCounting/"+own,null,200,true);await Confirm("Staff",own,200);
        foreach(var assignee in new Guid?[]{other,null})
        {var id=await Sheet(assignee);await Send("Staff","GET",prefix+"CycleCounting/"+id,null,403,true);await Confirm("Staff",id,403,true);}
        foreach(var role in new[]{"Admin","WarehouseManager"}){var id=await Sheet(other);await Send(role,"GET",prefix+"CycleCounting/"+id,null,200,true);await Confirm(role,id,200);}
        foreach(var role in new[]{"Admin","WarehouseManager","Staff"})
            await Send(role,"POST",prefix+"InventoryTransfers",new{productId=product,sourceBinId=source,destinationBinId=foreign,transferQuantity=4,lotNumber="LOT-DEFAULT",reason="H2 cross warehouse rejected"},400,true);
        await Send("Staff","POST",prefix+"InventoryTransfers",new{productId=product,sourceBinId=source,destinationBinId=destination,transferQuantity=4,lotNumber="LOT-DEFAULT",reason="H2 same warehouse distinct zones"},200);
        await using(var db=Db())
        {
            check(await db.BinInventories.Where(x=>x.BinId==source).Select(x=>x.Quantity).SingleAsync()==16&&await db.BinInventories.Where(x=>x.BinId==destination).Select(x=>x.Quantity).SingleAsync()==4,"Staff same-warehouse physical16/4");
            check((await db.Bins.FindAsync(source))!.CurrentOccupancy==16&&(await db.Bins.FindAsync(destination))!.CurrentOccupancy==4&&(await db.Bins.FindAsync(foreign))!.CurrentOccupancy==0,"same-warehouse occupancy16/4; foreign0");
            check(await db.InventoryTransactions.CountAsync(x=>x.TransactionType=="TRANSFER")==1,"exactly one committed transfer ledger; no rejected movement");
        }
        foreach(var path in new[]{"Products/"+product,"Products/list?searchKeyword=H2_MAIN","Products?searchKeyword=H2_MAIN"})
        {
            var j=await Send("Staff","GET",prefix+path,null,200,true);var d=j.GetProperty("data");var p=path.Contains("list?")?d[0]:path.Contains('?')?d.GetProperty("items")[0]:d;
            check(p.GetProperty("barcode").GetString()=="H2_BARCODE"&&p.GetProperty("weight").GetDouble()==321.5,"persisted barcode/weight correct "+path);
        }
        var detail=(await Send("WarehouseManager","GET",prefix+"Products/"+product,null,200,true)).GetProperty("data");
        await Send("WarehouseManager","PUT",prefix+"Products/"+product,new{id=product,sku=detail.GetProperty("sku").GetString(),barcode=detail.GetProperty("barcode").GetString(),name="H2 edited",unit=detail.GetProperty("unit").GetString(),description="edited supported field"},200);
        await using(var db=Db()){var p=await db.Products.FindAsync(product);check(p!.Barcode=="H2_BARCODE"&&p.Name=="H2 edited"&&p.Weight==321.5,"detail/edit roundtrip preserves barcode and persisted weight without weight editor");}
        await Send("Staff","POST",prefix+"OutboundOrders/validate-weight",new{sku="H2_MAIN",quantity=2,actualWeightGrams=793},400,true);
        // Legacy validator requires a nonempty ID; advisory handler does not load an order.
        var weight=await Send("Staff","POST",prefix+"OutboundOrders/validate-weight",new{orderId=Guid.NewGuid(),sku="H2_MAIN",quantity=2,actualWeightGrams=793},200,true);
        check(weight.GetProperty("data").GetProperty("isValid").GetBoolean()&&weight.GetProperty("data").GetProperty("expectedTotalWeightGrams").GetDouble()==793,"packing advice uses actual321.5g persisted weight");
        var degraded=new List<Guid>();
        foreach(var mode in new[]{"success","http-503","invalid-json","empty-vector"})
        {
            provider.Mode=mode;var sku="H2_CREATE_"+mode;
            var j=await Send("Admin","POST",prefix+"Products",new{sku,barcode=sku,name="H2 core create "+mode},200);var id=j.GetProperty("data").GetGuid();
            await using(var db=Db())
            {
                var p=await db.Products.FindAsync(id);check(p!=null,"valid core product persisted "+mode);
                check(mode=="success"?JsonSerializer.Deserialize<float[]>(p!.DescriptionEmbeddingJson!)!.Length==768:p!.DescriptionEmbeddingJson==null,"real vector or truthful null "+mode);
                check(!await db.BinInventories.AnyAsync(x=>x.ProductId==id),"product create does not invent stock "+mode);
            }
            if(mode!="success"){degraded.Add(id);check(j.GetProperty("message").GetString()!.Contains("embedding"),"degraded create message discloses missing enrichment "+mode);}
            var createdDetail=(await Send("Admin","GET",prefix+"Products/"+id,null,200,true)).GetProperty("data");
            check(createdDetail.GetProperty("barcode").GetString()==sku&&createdDetail.GetProperty("weight").GetDouble()==0,"new product returns persisted barcode and actual default weight0, not packing fallback250");
            await Send("Admin","POST",prefix+"Products",new{sku,name="duplicate"},409,true);
        }
        await Send("Admin","POST",prefix+"Products",new{sku="H2_INVALID",name=""},400,true);
        provider.Mode="success";
        var semantic=await Send("Staff","GET",prefix+"Products/semantic-search?text=H2",null,200);
        check(semantic.GetProperty("data").EnumerateArray().All(x=>!degraded.Contains(x.GetProperty("id").GetGuid())),"semantic search omits products without vectors; no fake hit");
        check(semantic.GetProperty("data").EnumerateArray().Any(x=>x.GetProperty("id").GetGuid()==product&&x.GetProperty("name").GetString()=="H2 edited"),"semantic registry serves current edited metadata");
        var created=semantic.GetProperty("data").EnumerateArray().First(x=>x.GetProperty("id").GetGuid()!=product).GetProperty("id").GetGuid();
        await Send("Admin","DELETE",prefix+"Products/"+created,null,200);
        var afterDelete=await Send("Staff","GET",prefix+"Products/semantic-search?text=H2",null,200);
        check(afterDelete.GetProperty("data").EnumerateArray().All(x=>x.GetProperty("id").GetGuid()!=created),"semantic stale cache does not return deleted product");
        await using(var stale=Db())
        {
            await stale.Bins.FindAsync(source);var cachedDestination=(await stale.Bins.FindAsync(destination))!;
            Guid movedZone;
            await using(var fresh=Db())
            {
                movedZone=(await fresh.Bins.FindAsync(foreign))!.ZoneId;
                (await fresh.Bins.FindAsync(destination))!.ZoneId=movedZone;
                await fresh.SaveChangesAsync();
            }
            check(cachedDestination.ZoneId!=movedZone,"transfer test retains stale tracked hierarchy");
            var before=await FixtureDatabase.Snapshot(fixture.Connection);
            var result=await new CreateInventoryTransferCommandHandler(stale,new InventoryMutationCoordinator(stale)).Handle(new(new CreateInventoryTransferRequest{ProductId=product,SourceBinId=source,DestinationBinId=destination,TransferQuantity=1,LotNumber="LOT-DEFAULT"}),default);
            check(!result.IsSuccess&&result.Error?.Code==ErrorCodeConstants.ValidationError,"cross-warehouse guard uses current SQL hierarchy despite stale tracked bins");
            check(before==await FixtureDatabase.Snapshot(fixture.Connection),"stale-hierarchy rejection preserves all SQL/occupancy/ledger/audit");
        }
        await File.WriteAllTextAsync(Path.Combine(report,"http-cases.json"),JsonSerializer.Serialize(records,new JsonSerializerOptions{WriteIndented=true}));
    }
}
