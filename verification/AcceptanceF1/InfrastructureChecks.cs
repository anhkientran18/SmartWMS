using System.Diagnostics;
using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using SmartWMS.Domain.Entities;
using SmartWMS.Infrastructure.Persistence.DbContext;
using SmartWMS.Infrastructure.Services;

static class InfrastructureChecks
{
    public static async Task Run(string report,string apiDll,Action<bool,string> check)
    {
        await using var fixture=new FixtureDatabase("F1 infrastructure endpoints and expired JWT; isolated SQL only");
        var password=Convert.ToHexString(RandomNumberGenerator.GetBytes(16));
        await using(var db=new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(fixture.Connection).Options,new FixtureUser()))
        {await db.Database.MigrateAsync();db.Users.Add(new User{Username="f1-infra",Email="infra@example.invalid",Role="Admin",IsActive=true,PasswordHash=new PasswordHasher().HashPassword(password)});await db.SaveChangesAsync();}
        var listener=new TcpListener(IPAddress.Loopback,0);listener.Start();var port=((IPEndPoint)listener.LocalEndpoint).Port;listener.Stop();
        var secret=Convert.ToHexString(RandomNumberGenerator.GetBytes(32));apiDll=Path.GetFullPath(apiDll);
        var start=new ProcessStartInfo("dotnet"){WorkingDirectory=report,UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true};
        start.ArgumentList.Add(apiDll);start.ArgumentList.Add("--contentRoot");start.ArgumentList.Add(Path.GetDirectoryName(apiDll)!);
        start.Environment["ASPNETCORE_ENVIRONMENT"]="Development";start.Environment["ASPNETCORE_URLS"]=$"http://127.0.0.1:{port}";
        start.Environment["ConnectionStrings__DefaultConnection"]=fixture.Connection;start.Environment["ConnectionStrings__HangfireConnection"]=fixture.Connection;
        start.Environment["JwtSettings__Secret"]=secret;
        foreach(var key in new[]{"DatabaseInitialization__ApplyMigrationsOnStartup","DatabaseInitialization__SeedOnStartup","Hangfire__EnableServer","Hangfire__RegisterRecurringJobsOnStartup"})start.Environment[key]="false";
        start.Environment["Hangfire__PrepareSchemaIfNecessary"]="true";
        using var host=Process.Start(start)!;var output=host.StandardOutput.ReadToEndAsync();var error=host.StandardError.ReadToEndAsync();
        using var http=new HttpClient{BaseAddress=new Uri($"http://127.0.0.1:{port}"),Timeout=TimeSpan.FromSeconds(30)};
        try
        {
            bool ready=false;for(int i=0;i<100&&!host.HasExited;i++){try{using var r=await http.GetAsync("/openapi/v1.json");if(r.IsSuccessStatusCode){ready=true;break;}}catch(HttpRequestException){}await Task.Delay(200);}
            check(ready,"Development OpenAPI200 actual infrastructure route");
            using(var r=await http.GetAsync("/healthz"))check(r.IsSuccessStatusCode&&(await r.Content.ReadAsStringAsync()).Contains("Healthy"),"healthz200 healthy SQL fixture");
            using(var r=await http.GetAsync("/health"))check(r.StatusCode==HttpStatusCode.NotFound,"/health404: actual public health route is /healthz, no route invented");
            using(var r=await http.GetAsync("/swagger/index.html"))check(r.IsSuccessStatusCode&&r.Content.Headers.ContentType?.MediaType=="text/html","Development Swagger UI200 HTML");
            using(var r=await http.GetAsync("/hangfire"))check(r.IsSuccessStatusCode&&r.Content.Headers.ContentType?.MediaType=="text/html","Hangfire existing local-only dashboard200 HTML, server and registration disabled");
            var storage=new Hangfire.SqlServer.SqlServerStorage(fixture.Connection,new Hangfire.SqlServer.SqlServerStorageOptions{PrepareSchemaIfNecessary=false});
            var filter=new Hangfire.Dashboard.LocalRequestsOnlyAuthorizationFilter();
            using var dashboardServices=new ServiceCollection().BuildServiceProvider();
            var context=new Microsoft.AspNetCore.Http.DefaultHttpContext{RequestServices=dashboardServices};context.Connection.LocalIpAddress=IPAddress.Loopback;
            context.Connection.RemoteIpAddress=IPAddress.Parse("198.51.100.25");
            check(!filter.Authorize(new Hangfire.Dashboard.AspNetCoreDashboardContext(storage,new Hangfire.DashboardOptions(),context)),"Hangfire actual default local-only filter rejects external remote IP");
            context.Connection.RemoteIpAddress=IPAddress.Loopback;
            check(filter.Authorize(new Hangfire.Dashboard.AspNetCoreDashboardContext(storage,new Hangfire.DashboardOptions(),context)),"Hangfire actual default local-only filter permits loopback; proxy deployment still requires policy decision");
            using(var r=await http.PostAsync("/hubs/inventory/negotiate?negotiateVersion=1",new StringContent("")))check(r.StatusCode==HttpStatusCode.Unauthorized,"SignalR negotiate anonymous401");
            string token;
            using(var r=await http.PostAsJsonAsync("/api/v1/Auth/login",new{username="f1-infra",password}))
            {check(r.StatusCode==HttpStatusCode.OK,"infrastructure real login200");var j=await r.Content.ReadFromJsonAsync<JsonElement>();token=j.GetProperty("data").GetProperty("token").GetString()!;}
            http.DefaultRequestHeaders.Authorization=new AuthenticationHeaderValue("Bearer",token);
            using(var r=await http.PostAsync("/hubs/inventory/negotiate?negotiateVersion=1",new StringContent("")))
            {var j=await r.Content.ReadFromJsonAsync<JsonElement>();check(r.IsSuccessStatusCode&&j.GetProperty("connectionToken").GetString()!.Length>0,"SignalR authenticated negotiation200 with connection token (not persisted)");}
            var valid=new JwtSecurityTokenHandler().ReadJwtToken(token);
            var expired=new JwtSecurityToken(valid.Issuer,valid.Audiences.First(),notBefore:DateTime.UtcNow.AddHours(-3),expires:DateTime.UtcNow.AddHours(-2),signingCredentials:new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret)),SecurityAlgorithms.HmacSha256));
            http.DefaultRequestHeaders.Authorization=new AuthenticationHeaderValue("Bearer",new JwtSecurityTokenHandler().WriteToken(expired));
            using(var r=await http.GetAsync("/api/v1/Products/list"))check(r.StatusCode==HttpStatusCode.Unauthorized,"properly signed but expired JWT401");
        }
        finally{if(!host.HasExited)host.Kill(true);await host.WaitForExitAsync();await File.WriteAllTextAsync(Path.Combine(report,"host.log"),await output+await error);}
    }
}
