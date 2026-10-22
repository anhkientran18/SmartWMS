using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Features.OutboundOrders.DTOs.Commands;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums;
using SmartWMS.Infrastructure.Persistence.DbContext;
using SmartWMS.Infrastructure.Services;

static class HttpSmoke
{
    public static async Task Run(string report, string apiDll, Action<bool,string> check)
    {
        await using var fixture = new FixtureDatabase("B3 HTTP clean fixture");
        Console.WriteLine("Fixture database: " + fixture.Name);
        ApplicationDbContext Db() => new(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(fixture.Connection).Options,new FixtureUser());
        var password=Convert.ToHexString(RandomNumberGenerator.GetBytes(16));
        Guid binId, noneId, lotId;
        await using(var db=Db())
        {
            await db.Database.MigrateAsync();
            var wh=new Warehouse { Code="HTTP-W",Name="W" }; var zone=new Zone {Code="HTTP-Z",Name="Z",Warehouse=wh};
            var bin=new Bin {Id=Guid.NewGuid(),Code="HTTP-B",Zone=zone,MaxCapacity=100,CurrentOccupancy=20};
            var none=new Product {SKU="HTTP-NONE",Barcode="HTTP-NONE",Name="None"};
            var lot=new Product {SKU="HTTP-LOT",Barcode="HTTP-LOT",Name="Lot",TrackingMode=ProductTrackingMode.Lot};
            db.BinInventories.AddRange(new BinInventory {Bin=bin,Product=none,LotNumber="LOT-DEFAULT",Quantity=10,Status=InventoryStatus.Available},
                new BinInventory {Bin=bin,Product=lot,LotNumber="LOT-2026",ExpirationDate=DateTime.UtcNow.AddDays(100),Quantity=10,Status=InventoryStatus.Available});
            db.Users.Add(new User {Username="b3-http",Email="b3@example.invalid",Role="Admin",IsActive=true,PasswordHash=new PasswordHasher().HashPassword(password)});
            await db.SaveChangesAsync(); binId=bin.Id;noneId=none.Id;lotId=lot.Id;
        }
        var listener=new TcpListener(IPAddress.Loopback,0); listener.Start(); var port=((IPEndPoint)listener.LocalEndpoint).Port;listener.Stop();
        apiDll=Path.GetFullPath(apiDll);
        var start=new ProcessStartInfo("dotnet") {WorkingDirectory=report,CreateNoWindow=true,UseShellExecute=false,RedirectStandardOutput=true,RedirectStandardError=true};
        start.ArgumentList.Add(apiDll);start.ArgumentList.Add("--contentRoot");start.ArgumentList.Add(Path.GetDirectoryName(apiDll)!);
        start.Environment["ASPNETCORE_ENVIRONMENT"]="Development";start.Environment["ASPNETCORE_URLS"]=$"http://127.0.0.1:{port}";
        start.Environment["ConnectionStrings__DefaultConnection"]=fixture.Connection;start.Environment["ConnectionStrings__HangfireConnection"]=fixture.Connection;
        start.Environment["JwtSettings__Secret"]=Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        foreach(var key in new[]{"DatabaseInitialization__ApplyMigrationsOnStartup","DatabaseInitialization__SeedOnStartup","Hangfire__EnableServer","Hangfire__RegisterRecurringJobsOnStartup","Hangfire__PrepareSchemaIfNecessary"}) start.Environment[key]="false";
        using var process=Process.Start(start)!;var stdout=process.StandardOutput.ReadToEndAsync();var stderr=process.StandardError.ReadToEndAsync();
        using var http=new HttpClient {BaseAddress=new Uri($"http://127.0.0.1:{port}"),Timeout=TimeSpan.FromSeconds(20)};
        try
        {
            bool ready=false;
            for(int i=0;i<100&&!process.HasExited;i++)
            {
                try {using var r=await http.GetAsync("/openapi/v1.json");if(r.IsSuccessStatusCode){ready=true;break;}}
                catch(HttpRequestException){}
                await Task.Delay(200);
            }
            check(ready,"HTTP API boots on actual migrated clean B3 fixture; jobs/seed off");
            using var login=await http.PostAsJsonAsync("/api/v1/Auth/login",new {username="b3-http",password});
            check(login.StatusCode==HttpStatusCode.OK,"HTTP login Admin succeeds");
            var token=(await login.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data").GetProperty("token").GetString();
            http.DefaultRequestHeaders.Authorization=new AuthenticationHeaderValue("Bearer",token);
            const string root="/api/v1/OutboundOrders";
            async Task<JsonElement> Data(string url)
            {
                using var response=await http.GetAsync(url);check(response.StatusCode==HttpStatusCode.OK,"HTTP GET "+url);
                return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");
            }
            async Task<JsonElement> Post(string url,object body)
            {
                using var response=await http.PostAsJsonAsync(url,body);
                var json=await response.Content.ReadAsStringAsync();
                check(response.StatusCode==HttpStatusCode.OK,"HTTP POST "+url+" success: "+response.StatusCode);
                using var parsed=JsonDocument.Parse(json);
                check(parsed.RootElement.GetProperty("isSuccess").GetBoolean(),"HTTP mutation result isSuccess=true");
                return parsed.RootElement.GetProperty("data").Clone();
            }
            var id=(await Post(root,new {orderNumber="HTTP-B3",binId,expectedShipDate=DateTime.UtcNow.Date.AddDays(1),items=new[]{new {productId=noneId,requestedQuantity=4},new {productId=lotId,requestedQuantity=3}}})).GetGuid();
            var detail=await Data(root+"/"+id);
            check(detail.GetProperty("status").GetString()=="Pending" && detail.GetProperty("isDirectPick").GetBoolean() && detail.GetProperty("items").GetArrayLength()==2,"HTTP create persists Pending/direct-pick and two lines");
            await Post(root+"/allocate-pick-task",new {outboundOrderId=id});
            detail=await Data(root+"/"+id);
            check(detail.GetProperty("status").GetString()=="Allocated" && detail.GetProperty("items").EnumerateArray().Sum(x=>x.GetProperty("reservedQuantity").GetInt32())==7,"HTTP allocation exposes reserved progress");
            var payload=new DirectPickRequest {Items=detail.GetProperty("items").EnumerateArray().SelectMany(x=>x.GetProperty("reservations").EnumerateArray()).Select(x=>new DirectPickItemRequest {ReservationId=x.GetProperty("id").GetGuid(),Quantity=x.GetProperty("quantity").GetInt32()}).ToList()};
            check(payload.Items.Count==2 && detail.GetProperty("items").EnumerateArray().Single(x=>x.GetProperty("productId").GetGuid()==lotId).GetProperty("reservations")[0].GetProperty("lotNumber").GetString()=="LOT-2026","HTTP detail exposes exact reservation identity and Lot snapshot");
            var summary=await Data("/api/v1/Inventory/stock-summary");
            check(summary.GetProperty("totalQuantity").GetInt64()==20,"HTTP allocation keeps physical summary 20");
            await using(var db=Db()) check(await db.BinInventories.SumAsync(x=>x.ReservedQuantity)==7 && (await db.Bins.SingleAsync(x=>x.Id==binId)).CurrentOccupancy==20,"allocation reserved=7, occupancy=20 in DB");
            await Post(root+$"/{id}/pick",payload);
            detail=await Data(root+"/"+id);
            check(detail.GetProperty("status").GetString()=="Picked" && detail.GetProperty("items").EnumerateArray().Sum(x=>x.GetProperty("pickedQuantity").GetInt32())==7 && detail.GetProperty("items").EnumerateArray().All(x=>x.GetProperty("reservedQuantity").GetInt32()==0),"HTTP pick progress=7/reserved=0");
            summary=await Data("/api/v1/Inventory/stock-summary");check(summary.GetProperty("totalQuantity").GetInt64()==13,"HTTP pick physical summary drops once to 13");
            await using(var db=Db()) check(await db.BinInventories.SumAsync(x=>x.ReservedQuantity)==0 && (await db.Bins.SingleAsync(x=>x.Id==binId)).CurrentOccupancy==13,"HTTP pick occupancy/reservation counters consistent");
            var beforeRetry=await FixtureDatabase.Snapshot(fixture.Connection);
            using(var retry=await http.PostAsJsonAsync(root+$"/{id}/pick",payload)) check(retry.StatusCode==HttpStatusCode.Conflict,"HTTP duplicate pick409");
            check(beforeRetry==await FixtureDatabase.Snapshot(fixture.Connection),"HTTP duplicate pick no duplicate ledger/audit/stock");
            await Post(root+$"/{id}/pack",new{});
            detail=await Data(root+"/"+id);check(detail.GetProperty("status").GetString()=="Packed","HTTP pack persists Packed");
            await Post(root+$"/{id}/ship",new{});
            detail=await Data(root+"/"+id);
            check(detail.GetProperty("status").GetString()=="Shipped" && detail.GetProperty("items").EnumerateArray().Sum(x=>x.GetProperty("shippedQuantity").GetInt32())==7,"HTTP ship terminal status/progress match quantities");
            summary=await Data("/api/v1/Inventory/stock-summary");check(summary.GetProperty("totalQuantity").GetInt64()==13,"HTTP pack/ship do not deduct inventory again");
            await Data("/api/v1/Inventory/stock-history");
            await using(var db=Db())
            {
                check(await db.InventoryTransactions.Where(x=>x.TransactionType=="OUTBOUND").SumAsync(x=>x.QuantityChanged)==-7 && await db.InventoryTransactions.CountAsync(x=>x.TransactionType=="OUTBOUND")==2,"HTTP ledger exactly two physical picks totalling -7");
                check(await db.InventoryTransactions.CountAsync(x=>x.TransactionType=="SHIP_CONFIRM" && x.QuantityChanged==0)==2 && await db.InventoryReservations.CountAsync(x=>x.Status=="Shipped" && x.Quantity==x.ShippedQuantity)==2,"HTTP ship records confirmation/reservation history, no second physical movement");
                check(await db.AuditLogs.AnyAsync() && await db.BinInventories.SumAsync(x=>x.Quantity)==13 && !await db.BinInventories.AnyAsync(x=>x.ReservedQuantity!=0),"HTTP final stock/audit/reservation state verified");
            }
            var shipped=await FixtureDatabase.Snapshot(fixture.Connection);
            await Post(root+$"/{id}/ship",new{});
            check(shipped==await FixtureDatabase.Snapshot(fixture.Connection),"HTTP duplicate ship is side-effect-free success");
            // Exercise existing DELETE adapter, not only the lifecycle service.
            var cancelId=(await Post(root,new {orderNumber="HTTP-CANCEL",binId,expectedShipDate=DateTime.UtcNow.Date.AddDays(1),items=new[]{new {productId=noneId,requestedQuantity=1}}})).GetGuid();
            await Post(root+"/allocate-pick-task",new {outboundOrderId=cancelId});
            using(var response=await http.DeleteAsync(root+"/"+cancelId)) check(response.StatusCode==HttpStatusCode.OK,"HTTP Allocated DELETE cancellation succeeds");
            await using(var db=Db()) check(await db.BinInventories.SumAsync(x=>x.Quantity)==13 && await db.BinInventories.SumAsync(x=>x.ReservedQuantity)==0 &&
                (await db.OutboundIssues.SingleAsync(x=>x.Id==cancelId)).IsDeleted,"HTTP cancel releases reservation without physical movement");
            using(var schema=await http.GetAsync("/openapi/v1.json")) await File.WriteAllTextAsync(Path.Combine(report,"openapi.json"),await schema.Content.ReadAsStringAsync());
        }
        finally
        {
            if(!process.HasExited)process.Kill(entireProcessTree:true);
            await process.WaitForExitAsync();await File.WriteAllTextAsync(Path.Combine(report,"http-host.log"),await stdout+await stderr);
        }
    }
}
