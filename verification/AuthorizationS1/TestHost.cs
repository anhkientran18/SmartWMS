using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text.Json;

sealed class TestHost : IAsyncDisposable
{
    public readonly HttpClient Http;
    public readonly ProcessStartInfo Start;
    public readonly string Secret;
    readonly Process process;readonly Task<string> output,error;readonly string report;
    TestHost(ProcessStartInfo start,string folder,int port,string secret)
    {
        Start=start;Secret=secret;report=folder;process=Process.Start(start)!;output=process.StandardOutput.ReadToEndAsync();error=process.StandardError.ReadToEndAsync();
        Http=new HttpClient{BaseAddress=new Uri($"http://127.0.0.1:{port}"),Timeout=TimeSpan.FromSeconds(45)};
    }
    public static async Task<TestHost> Boot(string api,string connection,string provider,string folder,bool missingModels=false,bool invalidModel=false)
    {
        Directory.CreateDirectory(folder);var socket=new TcpListener(IPAddress.Loopback,0);socket.Start();int port=((IPEndPoint)socket.LocalEndpoint).Port;socket.Stop();
        api=Path.GetFullPath(api);var secret=Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var s=new ProcessStartInfo("dotnet"){WorkingDirectory=folder,UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true};
        s.ArgumentList.Add(api);s.ArgumentList.Add("--contentRoot");s.ArgumentList.Add(Path.GetDirectoryName(api)!);
        s.Environment["ASPNETCORE_ENVIRONMENT"]="Production";s.Environment["ASPNETCORE_URLS"]=$"http://127.0.0.1:{port}";
        s.Environment["ConnectionStrings__DefaultConnection"]=connection;s.Environment["ConnectionStrings__HangfireConnection"]=connection;s.Environment["JwtSettings__Secret"]=secret;
        s.Environment["JwtSettings__Issuer"]="F1-deterministic";s.Environment["JwtSettings__Audience"]="F1-deterministic-clients";
        foreach(var k in new[]{"DatabaseInitialization__ApplyMigrationsOnStartup","DatabaseInitialization__SeedOnStartup","Hangfire__EnableServer","Hangfire__RegisterRecurringJobsOnStartup"})s.Environment[k]="false";
        s.Environment["Hangfire__PrepareSchemaIfNecessary"]="true";
        s.Environment["DatabaseInitialization__AllowedMigrationEnvironments__0"]="Production"; // Fixture process only.
        s.Environment["GeminiSettings__ApiKey"]="F1-deterministic-only";s.Environment["GeminiSettings__BaseUrl"]=provider;
        foreach(var k in new[]{"DefaultModel","ProModel","EmbeddingModel"})s.Environment["GeminiSettings__"+k]=missingModels?"":invalidModel?"bad-model":"configured-fixture-model";
        var host=new TestHost(s,folder,port,secret);
        for(int i=0;i<150&&!host.process.HasExited;i++)
        {try{using var r=await host.Http.GetAsync("/api/v1/Products/list");if(r.StatusCode==HttpStatusCode.Unauthorized)return host;}catch(HttpRequestException){}await Task.Delay(200);}
        await host.DisposeAsync();throw new Exception("Fixture API did not boot; inspect sanitized host log");
    }
    public async Task<string> Login(string role,string password)
    {
        using var response=await Http.PostAsJsonAsync("/api/v1/Auth/login",new{username="f1-"+role,password});
        if(!response.IsSuccessStatusCode)throw new Exception("Fixture login failed");var j=await response.Content.ReadFromJsonAsync<JsonElement>();var token=j.GetProperty("data").GetProperty("token").GetString()!;
        Http.DefaultRequestHeaders.Authorization=new AuthenticationHeaderValue("Bearer",token);return token;
    }
    public async ValueTask DisposeAsync(){Http.Dispose();if(!process.HasExited)process.Kill(true);await process.WaitForExitAsync();await File.WriteAllTextAsync(Path.Combine(report,"host.log"),await output+await error);process.Dispose();}
}
