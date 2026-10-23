using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Domain.Entities;
using SmartWMS.Infrastructure.Persistence.DbContext;
using SmartWMS.Infrastructure.Services;

static class HttpSmoke
{
    public static async Task Run(string report, string apiDll, Action<bool,string> check)
    {
        bool deterministic=Environment.GetEnvironmentVariable("F1_DETERMINISTIC")=="1";
        using var provider=deterministic?new DeterministicProvider():null;
        await AiChecks.Run(check);
        await using var fixture = new FixtureDatabase("F1 actual HTTP/Newman SQL fixture; no shared DB, seed or jobs");
        ApplicationDbContext Db() => new(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(fixture.Connection).Options,new FixtureUser());
        var password=Convert.ToHexString(RandomNumberGenerator.GetBytes(16));
        await using(var db=Db())
        {
            await db.Database.MigrateAsync();
            check((await db.Database.GetAppliedMigrationsAsync()).Count()==31 && !db.Database.HasPendingModelChanges(),"31 existing migrations; no schema change");
            foreach(var role in new[]{"Admin","WarehouseManager","Staff"}) db.Users.Add(new User { Username="f1-"+role,Email="f1-"+role+"@example.invalid",Role=role,IsActive=true,PasswordHash=new PasswordHasher().HashPassword(password)});
            await db.SaveChangesAsync();
        }
        var listener=new TcpListener(IPAddress.Loopback,0);listener.Start();var port=((IPEndPoint)listener.LocalEndpoint).Port;listener.Stop();
        apiDll=Path.GetFullPath(apiDll);
        var start=new ProcessStartInfo("dotnet"){WorkingDirectory=report,CreateNoWindow=true,UseShellExecute=false,RedirectStandardOutput=true,RedirectStandardError=true};
        start.ArgumentList.Add(apiDll);start.ArgumentList.Add("--contentRoot");start.ArgumentList.Add(Path.GetDirectoryName(apiDll)!);
        start.Environment["ASPNETCORE_ENVIRONMENT"]="Development";start.Environment["ASPNETCORE_URLS"]=$"http://127.0.0.1:{port}";
        start.Environment["ConnectionStrings__DefaultConnection"]=fixture.Connection;start.Environment["ConnectionStrings__HangfireConnection"]=fixture.Connection;
        start.Environment["JwtSettings__Secret"]=Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        foreach(var key in new[]{"DatabaseInitialization__ApplyMigrationsOnStartup","DatabaseInitialization__SeedOnStartup","Hangfire__EnableServer","Hangfire__RegisterRecurringJobsOnStartup","Hangfire__PrepareSchemaIfNecessary"}) start.Environment[key]="false";
        // Existing Hangfire storage schema only, so metrics can read an empty scheduler.
        // Server/recurring registration remain disabled; no business migration is added.
        start.Environment["Hangfire__PrepareSchemaIfNecessary"]="true";
        if(provider!=null)
        {
            start.Environment["GeminiSettings__BaseUrl"]=provider.Url;start.Environment["GeminiSettings__ApiKey"]="F1-deterministic-only";
            foreach(var key in new[]{"DefaultModel","ProModel","EmbeddingModel"})start.Environment["GeminiSettings__"+key]="configured-fixture-model";
        }
        using var host=Process.Start(start)!;var stdout=host.StandardOutput.ReadToEndAsync();var stderr=host.StandardError.ReadToEndAsync();
        using var http=new HttpClient{BaseAddress=new Uri($"http://127.0.0.1:{port}"),Timeout=TimeSpan.FromSeconds(45)};
        var repo=Environment.GetEnvironmentVariable("F1_REPO")??throw new Exception("F1_REPO required");
        try
        {
            bool ready=false;
            for(int i=0;i<100&&!host.HasExited;i++){try{using var r=await http.GetAsync("/openapi/v1.json");if(r.IsSuccessStatusCode){ready=true;break;}}catch(HttpRequestException){} await Task.Delay(200);}
            check(ready,"actual API boot with fixture connection and jobs/seed disabled");if(!ready)throw new Exception("Host failed");
            using var routes=JsonDocument.Parse(await File.ReadAllTextAsync(Path.Combine(repo,"obj/F1/routes.json")));
            foreach(var row in routes.RootElement.EnumerateArray())
            {
                var method=row.GetProperty("method").GetString()!;var route=row.GetProperty("route").GetString()!;
                if(route.EndsWith("/login"))continue;
                route=System.Text.RegularExpressions.Regex.Replace(route,@"\{[^}]+\}",Guid.Empty.ToString());
                using var request=new HttpRequestMessage(new HttpMethod(method),route);
                if(method is "POST" or "PUT")request.Content=JsonContent.Create(new{});
                if(route.EndsWith("/scan-invoice")||route.EndsWith("/report-damage"))request.Content=new MultipartFormDataContent();
                using var response=await http.SendAsync(request);
                check(response.StatusCode==HttpStatusCode.Unauthorized,"anonymous401 "+method+" "+row.GetProperty("route").GetString());
            }
            async Task Login(string role)
            {
                using var response=await http.PostAsJsonAsync("/api/v1/Auth/login",new{username="f1-"+role,password});
                check(response.IsSuccessStatusCode,"real auth "+role);
                var j=await response.Content.ReadFromJsonAsync<JsonElement>();
                http.DefaultRequestHeaders.Authorization=new AuthenticationHeaderValue("Bearer",j.GetProperty("data").GetProperty("token").GetString());
            }
            http.DefaultRequestHeaders.Authorization=new AuthenticationHeaderValue("Bearer","malformed");
            using(var r=await http.GetAsync("/api/v1/Products/list"))check(r.StatusCode==HttpStatusCode.Unauthorized,"malformed JWT401");
            await Login("Staff");
            foreach(var route in new[]{"Users","AuditLogs","Suppliers/list","Warehouses/list","Bins/list","Forecasts/demand-prediction?sku=missing"})
            {using var r=await http.GetAsync("/api/v1/"+route);check(r.StatusCode==HttpStatusCode.Forbidden,"Staff403 "+route);}
            using(var r=await http.GetAsync("/api/v1/Customers/list"))check(r.StatusCode==HttpStatusCode.OK,"Staff allowed customer query");
            await Login("Admin");
            var before=await FixtureDatabase.Snapshot(fixture.Connection);
            foreach(var route in new[]{"Chat/ask"})
            {
                foreach(var message in new[]{"",new string('x',2001)})
                {using var r=await http.PostAsJsonAsync("/api/v1/"+route,new{message});check(r.StatusCode==HttpStatusCode.BadRequest,"chat empty/oversize400");}
            }
            foreach(var action in new[]{"scan-invoice","report-damage"})
            {
                foreach(var kind in new[]{"empty","extension","signature","traversal","size"})
                {
                    using var form=new MultipartFormDataContent();
                    byte[] bytes=kind=="empty"?[]:kind=="size"?new byte[5*1024*1024+1]:[1,2,3];
                    using var file=new ByteArrayContent(bytes);file.Headers.ContentType=new MediaTypeHeaderValue("image/png");
                    form.Add(file,"file",kind=="extension"?"a.exe":kind=="traversal"?"../a.png":"a.png");
                    using var r=await http.PostAsync("/api/v1/InboundReceipts/"+action,form);
                    check(r.StatusCode==HttpStatusCode.BadRequest,"upload "+action+" "+kind+"400");
                }
            }
            check(before==await FixtureDatabase.Snapshot(fixture.Connection),"invalid AI/upload requests preserve complete database snapshot");
            var run=new ProcessStartInfo("node"){WorkingDirectory=repo,CreateNoWindow=true,UseShellExecute=false,RedirectStandardOutput=true,RedirectStandardError=true};
            run.ArgumentList.Add(Path.Combine(repo,"verification/AcceptanceF1/RunPostman.cjs"));
            run.Environment["F1_BASEURL"]=http.BaseAddress.ToString().TrimEnd('/');run.Environment["F1_USERNAME"]="f1-Admin";run.Environment["F1_PASSWORD"]=password;run.Environment["F1_REPORT"]=Path.Combine(report,"newman.json");
            using(var process=Process.Start(run)!)
            {
                var output=process.StandardOutput.ReadToEndAsync();var error=process.StandardError.ReadToEndAsync();
                await process.WaitForExitAsync().WaitAsync(TimeSpan.FromMinutes(15));Console.WriteLine(await output);Console.WriteLine(await error);
                check(File.Exists(Path.Combine(report,"newman.json")),"Newman produced sanitized runtime evidence");
                check(process.ExitCode==0,deterministic?"Newman deterministic assertions pass (not live evidence)":"Newman live happy-path assertions all pass");
            }
            await using(var db=Db())
            {
                var stocks=await db.BinInventories.ToListAsync();var bins=await db.Bins.ToListAsync();
                check(stocks.All(x=>x.Quantity>=0&&x.ReservedQuantity>=0&&x.ReservedQuantity<=x.Quantity),"post-workflow physical and ATP invariants");
                check(bins.All(b=>b.CurrentOccupancy==stocks.Where(x=>x.BinId==b.Id).Sum(x=>(long)x.Quantity)&&b.CurrentOccupancy<=b.MaxCapacity),"post-workflow occupancy equals physical sums and capacity");
                check(await db.InventoryTransactions.AnyAsync(x=>x.TransactionType=="INBOUND"),"inbound SQL ledger persisted");
                check(await db.InventoryTransactions.AnyAsync(x=>x.TransactionType=="OUTBOUND"),"B3 SQL outbound ledger persisted");
                check(await db.AuditLogs.AnyAsync(),"actual SQL audit pipeline persisted");
                check(stocks.Where(x=>bins.Single(b=>b.Id==x.BinId).Code.EndsWith("_SOURCE")).Sum(x=>x.Quantity)==104,
                    "SQL source120+adjust1-transfer1-kit4-refill9-pick3=104; Pack/Ship do not deduct again");
                check(stocks.Where(x=>bins.Single(b=>b.Id==x.BinId).Code.EndsWith("_TARGET")).Sum(x=>x.Quantity)==10,
                    "SQL destination1+refill9=10, repeat creates no duplicate refill");
                check(stocks.Where(x=>bins.Single(b=>b.Id==x.BinId).Code.EndsWith("_KIT")).Sum(x=>x.Quantity)==2,
                    "SQL K1 output2 matches consumed component4");
                check(await db.InventoryTransactions.CountAsync(x=>x.TransactionType=="OUTBOUND")==1&&
                    await db.InventoryTransactions.CountAsync(x=>x.TransactionType=="KITTING_ISSUE")==1&&
                    await db.InventoryTransactions.CountAsync(x=>x.TransactionType=="KITTING_RECEIPT")==1,
                    "SQL exact outbound/kitting ledger counts; retries produce no duplicates");
                var component=await db.Products.SingleAsync(x=>!x.IsDeleted&&x.SKU.EndsWith("_P"));
                check(stocks.Where(x=>x.ProductId==component.Id).All(x=>x.LotNumber.EndsWith("_LOT")&&x.ExpirationDate.HasValue&&x.ReservedQuantity==0),
                    "SQL inbound/transfer/refill/pick preserve component lot/expiry; all reservations consumed");
                var products=await db.Products.Where(x=>!x.IsDeleted).ToListAsync();
                check(products.Count>=2&&products.All(x=>JsonSerializer.Deserialize<float[]>(x.DescriptionEmbeddingJson??"[]")?.Length==768),"API-created products have validated 768-dimensional embeddings; provider mode explicitly recorded");
            }
            string sku;Guid zone;
            await using(var db=Db()){sku=await db.Products.Where(x=>!x.IsDeleted&&x.SKU.EndsWith("_P")).Select(x=>x.SKU).SingleAsync();zone=await db.Zones.Where(x=>!x.IsDeleted).Select(x=>x.Id).SingleAsync();}
            var beforeFailures=await FixtureDatabase.Snapshot(fixture.Connection);
            if(provider!=null)await ExhaustiveHttp.Run(fixture.Connection,apiDll,password,report,sku,zone,check);
            else await FailureHttp.Run(start,password,report,sku,zone,check);
            if(provider==null)check(beforeFailures==await FixtureDatabase.Snapshot(fixture.Connection),"all controlled AI HTTP failures and executive fallback preserve complete SQL database");
        }
        finally
        {
            if(!host.HasExited)host.Kill(true);await host.WaitForExitAsync();
            await File.WriteAllTextAsync(Path.Combine(report,"http-host.log"),await stdout+await stderr);
        }
    }
}
