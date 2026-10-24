using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SmartWMS.Application.Features.CycleCounting.Commands.CreateCountSheet;
using SmartWMS.Application.Features.CycleCounting.DTOs.Commands;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums;
using SmartWMS.Infrastructure.Persistence.DbContext;
using SmartWMS.Infrastructure.Services;

static class AuthorizationChecks
{
    public static async Task Run(string report,string api,Action<bool,string> check)
    {
        await using var fixture=new FixtureDatabase("S1 authorization/assignment; no shared DB and no live provider calls");
        ApplicationDbContext Db()=>new(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(fixture.Connection).Options,new FixtureUser());
        var password=Convert.ToHexString(RandomNumberGenerator.GetBytes(20));
        var staff=Guid.NewGuid();var other=Guid.NewGuid();var bin=Guid.NewGuid();var zone=Guid.NewGuid();var product=Guid.NewGuid();
        await using(var db=Db())
        {
            await db.Database.MigrateAsync();
            check(!db.Database.HasPendingModelChanges()&&(await db.Database.GetAppliedMigrationsAsync()).Count()==31,"existing 31 migrations; model unchanged");
            foreach(var role in new[]{"Admin","WarehouseManager","Staff","Other"})
                db.Users.Add(new User{Id=role=="Staff"?staff:role=="Other"?other:Guid.NewGuid(),Username="f1-"+role,Email=role+"@example.invalid",Role=role,IsActive=true,PasswordHash=new PasswordHasher().HashPassword(password)});
            var warehouse=new Warehouse{Code="S1_W",Name="S1 fixture"};
            var z=new Zone{Id=zone,Code="S1_Z",Name="Khu Khô (Dry Zone)",Warehouse=warehouse};
            var b=new Bin{Id=bin,Code="S1_SOURCE",Zone=z,MaxCapacity=1000,CurrentOccupancy=20};
            var p=new Product{Id=product,SKU="S1_SKU",Barcode="S1_BAR",Name="S1 product",TrackingMode=ProductTrackingMode.None};
            db.BinInventories.Add(new BinInventory{Bin=b,Product=p,Quantity=20,LotNumber="LOT-DEFAULT",Status=InventoryStatus.Available});
            db.InventoryTransactions.Add(new InventoryTransaction{Id=Guid.NewGuid(),Product=p,TransactionType="OUTBOUND",QuantityChanged=-1,SourceBinCode="S1_SOURCE",ReasonCode="S1_HISTORY",CreatedAt=DateTime.UtcNow.AddDays(-1)});
            await db.SaveChangesAsync();
        }
        using var provider=new DeterministicProvider();
        await using var host=await TestHost.Boot(api,fixture.Connection,provider.Url,Path.Combine(report,"host"));
        var tokens=new Dictionary<string,string>();
        foreach(var role in new[]{"Admin","WarehouseManager","Staff","Other"})tokens[role]=await host.Login(role,password);
        var jwt=new JwtSecurityTokenHandler().ReadJwtToken(tokens["Admin"]);
        tokens["Anonymous"]="";tokens["Malformed"]="malformed";
        tokens["Expired"]=new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(jwt.Issuer,jwt.Audiences.First(),notBefore:DateTime.UtcNow.AddHours(-3),expires:DateTime.UtcNow.AddHours(-2),signingCredentials:new(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(host.Secret)),SecurityAlgorithms.HmacSha256)));
        void Actor(string name)=>host.Http.DefaultRequestHeaders.Authorization=tokens[name]==""?null:new AuthenticationHeaderValue("Bearer",tokens[name]);
        var matrix=new List<object>();int rejected=0;
        async Task<JsonElement> Send(string actor,string method,string path,object? body,int expected,bool noMutation=false)
        {
            Actor(actor);var before=noMutation?await FixtureDatabase.Snapshot(fixture.Connection):"";var calls=provider.Observed.Count;
            using var req=new HttpRequestMessage(new HttpMethod(method),path);if(body!=null)req.Content=JsonContent.Create(body);
            using var res=await host.Http.SendAsync(req);var content=await res.Content.ReadAsStringAsync();
            check((int)res.StatusCode==expected,$"role/ownership {actor} {method} {path} expected{expected} actual{(int)res.StatusCode}");
            matrix.Add(new{actor,method,path,expected,status=(int)res.StatusCode});
            if(noMutation)
            {
                rejected++;check(before==await FixtureDatabase.Snapshot(fixture.Connection),"rejected/read request preserves ALL SQL rows/schema/ledger/audit "+actor+" "+path);
                check(calls==provider.Observed.Count,"rejected/read request makes zero provider calls "+actor+" "+path);
            }
            if(expected==200&&path.StartsWith("/api/")){using var json=JsonDocument.Parse(content);check(json.RootElement.GetProperty("isSuccess").GetBoolean(),"successful business response "+actor+" "+path);return json.RootElement.Clone();}
            return default;
        }
        async Task<Guid> Sheet(Guid? assignee)
        {
            await using var db=Db();var r=await new CreateCountSheetCommandHandler(db,new InventoryMutationCoordinator(db),new CycleCountCoordinator(db)).Handle(new(new CreateCountSheetRequest{BinId=bin,AssignedUserId=assignee}),default);
            if(!r.IsSuccess)throw new Exception("Fixture sheet creation failed: "+r.Message);return r.Data;
        }
        async Task<object> Confirm(Guid id,int delta=0)
        {
            await using var db=Db();var items=await db.CycleCountItems.Where(x=>x.CountSheetId==id).ToListAsync();
            return new{countSheetId=id,countedItems=items.Select(x=>new{itemId=x.Id,countedQuantity=x.SystemQuantity+delta}).ToArray()};
        }
        var prefix="/api/v1/";
        var firstSheet=await Sheet(staff);
        var cases=new[]{("POST","Inventory/adjust-stock"),("POST","Inventory/change-status"),("POST","Inventory/run-auto-replenish"),("POST","CycleCounting/create-sheet"),("GET","Dashboard/executive"),("GET","Dashboard/ai-slotting-recommendations"),("GET","CycleCounting/"+firstSheet),("POST","CycleCounting/confirm")};
        foreach(var actor in new[]{"Anonymous","Malformed","Expired"})foreach(var (method,path) in cases)
            await Send(actor,method,prefix+path,method=="POST"?new{}:null,401,true);
        // An unknown but valid role also fails closed on changed routes.
        foreach(var (method,path) in cases)await Send("Other",method,prefix+path,method=="POST"?new{}:null,403,true);
        foreach(var role in new[]{"Admin","WarehouseManager","Staff"})
        {
            var denied=role=="Staff";int status=denied?403:200;
            foreach(var quantity in new[]{1,-1})await Send(role,"POST",prefix+"Inventory/adjust-stock",new{binId=bin,productId=product,lotNumber="LOT-DEFAULT",adjustmentQuantity=quantity,reasonCode="S1_AUTH"},status,denied);
            foreach(var state in new[]{InventoryStatus.QCHold,InventoryStatus.Available})await Send(role,"POST",prefix+"Inventory/change-status",new{binId=bin,productId=product,lotNumber="LOT-DEFAULT",newStatus=(int)state,reasonCode="S1_AUTH"},status,denied);
            await Send(role,"POST",prefix+"Inventory/run-auto-replenish",null,status,denied);
            await Send(role,"POST",prefix+"CycleCounting/create-sheet",new{requestData=new{binId=bin,assignedUserId=staff}},status,denied);
            await Send(role,"GET",prefix+"Dashboard/executive",null,status,denied);
            await Send(role,"GET",prefix+"Dashboard/ai-slotting-recommendations?zoneId="+zone,null,status,denied);
            var id=await Sheet(staff);
            await Send(role,"GET",prefix+"CycleCounting/"+id,null,200,true);
            await Send(role,"POST",prefix+"CycleCounting/confirm",await Confirm(id,1),200);
            await using var db=Db();check((await db.CycleCountSheets.FindAsync(id))!.Status=="Completed","authorized confirmation persisted "+role);
        }
        // Cross-assignee, unassigned, malformed actor identity, foreign item and replay.
        foreach(var assignee in new Guid?[]{other,null})
        {
            var id=await Sheet(assignee);
            await Send("Staff","GET",prefix+"CycleCounting/"+id,null,403,true);
            await Send("Staff","POST",prefix+"CycleCounting/confirm",await Confirm(id),403,true);
            foreach(var role in new[]{"Admin","WarehouseManager"})await Send(role,"GET",prefix+"CycleCounting/"+id,null,200,true);
            await Send(assignee.HasValue?"Admin":"WarehouseManager","POST",prefix+"CycleCounting/confirm",await Confirm(id),200);
        }
        var own=await Sheet(staff);var foreign=await Sheet(other);
        var forged=await Confirm(foreign);
        using(var j=JsonDocument.Parse(JsonSerializer.Serialize(forged)))
            await Send("Staff","POST",prefix+"CycleCounting/confirm",new{countSheetId=own,countedItems=j.RootElement.GetProperty("countedItems").Clone()},400,true);
        await Send("Staff","POST",prefix+"CycleCounting/confirm",await Confirm(own),200);
        await Send("Staff","POST",prefix+"CycleCounting/confirm",await Confirm(own),409,true);
        var pending=await Send("Staff","GET",prefix+"CycleCounting/pending-tasks?operatorName=f1-Other",null,200,true);
        await using(var db=Db())
        {
            var ownIds=await db.CycleCountSheets.Where(x=>x.AssignedUserId==staff&&x.Status=="Pending").Select(x=>x.Id).ToListAsync();
            check(pending.GetProperty("data").EnumerateArray().All(x=>ownIds.Contains(x.GetProperty("countSheetId").GetGuid())),"legacy operatorName cannot spoof pending-task assignment");
            check(await db.InventoryTransactions.CountAsync(x=>x.TransactionType=="ADJUSTMENT")==7,"authorized adjustments/count corrections exact ledger count 4+3");
            check(await db.InventoryTransactions.CountAsync(x=>x.TransactionType=="STATUS_CHANGE")==4,"authorized status changes exact ledger count");
            check((await db.BinInventories.SingleAsync()).Quantity==23&&(await db.Bins.FindAsync(bin))!.CurrentOccupancy==23,"authorized stock and occupancy final SQL23");
        }
        // All existing public controller routes: anonymous, malformed and expired cannot enter handlers.
        var repo=Environment.GetEnvironmentVariable("S1_REPO")??throw new Exception("S1_REPO required");
        using var inventory=JsonDocument.Parse(await File.ReadAllTextAsync(Path.Combine(repo,"obj/S1/audit-before.json")));
        foreach(var actor in new[]{"Anonymous","Malformed","Expired"})
        {
            var before=await FixtureDatabase.Snapshot(fixture.Connection);var calls=provider.Observed.Count;
            foreach(var row in inventory.RootElement.EnumerateArray())
            {
                var route=row.GetProperty("route").GetString()!;if(route.EndsWith("/login"))continue;
                route=System.Text.RegularExpressions.Regex.Replace(route,@"\{[^}]+\}",Guid.Empty.ToString());
                var method=row.GetProperty("method").GetString()!;
                Actor(actor);using var request=new HttpRequestMessage(new HttpMethod(method),route);
                if(method is "POST" or "PUT")request.Content=JsonContent.Create(new{});
                if(route.EndsWith("/scan-invoice")||route.EndsWith("/report-damage"))request.Content=new MultipartFormDataContent();
                using var response=await host.Http.SendAsync(request);
                check(response.StatusCode==HttpStatusCode.Unauthorized,"all routes "+actor+" "+method+" "+route+" 401");
            }
            check(before==await FixtureDatabase.Snapshot(fixture.Connection),"all-route rejection batch SQL/ledger/audit unchanged "+actor);
            check(calls==provider.Observed.Count,"all-route rejection batch zero provider calls "+actor);
        }
        // Future Staff lookup/task contracts: actual reads and scanner parsing remain admitted.
        foreach(var path in new[]{"InboundReceipts/list","OutboundOrders/list","InventoryTransfers/list","Products/list","Inventory/stock-summary","InboundReceipts/putaway-suggestion?sku=S1_SKU&quantity=1","Products/S1_SKU/qrcode"})
        {
            Actor("Staff");using var response=await host.Http.GetAsync(prefix+path);check(response.StatusCode==HttpStatusCode.OK,"Staff execution lookup preserved "+path);
        }
        await Send("Staff","GET",prefix+"Bins/"+bin+"/contents",null,403,true);
        await Send("Staff","GET",prefix+"Forecasts/demand-prediction?sku=S1_SKU",null,403,true);
        await Send("Staff","POST",prefix+"Kitting/assemble",new{},403,true);
        await HandlerChecks.Run(fixture.Connection,bin,staff,check);
        await StaffExecution.Run(host,fixture.Connection,bin,zone,product,tokens["Admin"],tokens["Staff"],repo,check);
        await File.WriteAllTextAsync(Path.Combine(report,"role-matrix.json"),JsonSerializer.Serialize(matrix,new JsonSerializerOptions{WriteIndented=true}));
        check(rejected>=40,"individual SQL/ledger/audit/provider no-mutation checks >=40");
        check(provider.Observed.Count>0,"allowed Admin/WM executive/slotting reached loopback provider; forbidden calls checked separately");
    }
}
