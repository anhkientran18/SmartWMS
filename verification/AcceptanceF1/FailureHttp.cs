using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;

static class FailureHttp
{
    // Controlled HTTP dependency failures only. None of these are live happy-path evidence.
    public static async Task Run(ProcessStartInfo template, string password, string report, string sku, Guid zone, Action<bool,string> check)
    {
        using var gateway=new Gateway();
        var listener=new TcpListener(IPAddress.Loopback,0);listener.Start();var port=((IPEndPoint)listener.LocalEndpoint).Port;listener.Stop();
        var start=new ProcessStartInfo(template.FileName){WorkingDirectory=template.WorkingDirectory,UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true};
        foreach(var arg in template.ArgumentList)start.ArgumentList.Add(arg);
        foreach(var pair in template.Environment)start.Environment[pair.Key]=pair.Value;
        start.Environment["ASPNETCORE_URLS"]=$"http://127.0.0.1:{port}";
        start.Environment["GeminiSettings__BaseUrl"]=gateway.Url;
        start.Environment["GeminiSettings__ApiKey"]="F1-controlled-fixture-only";
        using var host=Process.Start(start)!;var stdout=host.StandardOutput.ReadToEndAsync();var stderr=host.StandardError.ReadToEndAsync();
        using var http=new HttpClient{BaseAddress=new Uri($"http://127.0.0.1:{port}"),Timeout=TimeSpan.FromSeconds(45)};
        try
        {
            bool ready=false;for(int i=0;i<100&&!host.HasExited;i++){try{using var r=await http.GetAsync("/openapi/v1.json");if(r.IsSuccessStatusCode){ready=true;break;}}catch(HttpRequestException){}await Task.Delay(200);}
            check(ready,"controlled-failure API host boots");if(!ready)throw new Exception("Controlled host failed");
            using(var r=await http.PostAsJsonAsync("/api/v1/Auth/login",new{username="f1-Admin",password}))
            {var j=await r.Content.ReadFromJsonAsync<JsonElement>();http.DefaultRequestHeaders.Authorization=new AuthenticationHeaderValue("Bearer",j.GetProperty("data").GetProperty("token").GetString());}
            foreach(var mode in new[]{"provider429","malformed-json","empty-candidates","empty-text","invalid-business-json","timeout","provider500"})
            {
                gateway.Status=mode=="provider429"?429:mode=="provider500"?500:200;
                gateway.DelayMilliseconds=mode=="timeout"?35000:0;
                gateway.Body=mode switch{"malformed-json"=>"not-json","empty-candidates"=>"{\"candidates\":[]}","empty-text"=>"{\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"\"}]}}]}","invalid-business-json"=>"{\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"{}\"}]}}]}",_=>"{}"};
                var paths=new[]{"/api/v1/Chat/ask","/api/v1/Forecasts/demand-prediction?sku="+sku,"/api/v1/Dashboard/ai-slotting-recommendations?zoneId="+zone,"/api/v1/Products/semantic-search?text=stock","/api/v1/Products","/api/v1/InboundReceipts/scan-invoice","/api/v1/InboundReceipts/report-damage","/api/v1/Dashboard/executive"};
                foreach(var path in paths)
                {
                    if(mode=="timeout"&&!path.EndsWith("/ask"))continue; // Shared transport timeout, tested once over actual HTTP.
                    using var request=new HttpRequestMessage(path.Contains("/ask")||path=="/api/v1/Products"||path.Contains("scan-invoice")||path.Contains("report-damage")?HttpMethod.Post:HttpMethod.Get,path);
                    if(path.Contains("/ask"))request.Content=JsonContent.Create(new{message="F1 controlled dependency failure"});
                    else if(path=="/api/v1/Products")request.Content=JsonContent.Create(new{sku="F1_FAIL_"+Guid.NewGuid().ToString("N"),barcode=Guid.NewGuid().ToString("N"),name="Failure fixture",description="Not persisted",unit="Pcs",trackingMode=0});
                    else if(path.Contains("scan-invoice")||path.Contains("report-damage"))
                    {var form=new MultipartFormDataContent();var bytes=new ByteArrayContent(new byte[]{137,80,78,71,13,10,26,10,0});bytes.Headers.ContentType=new("image/png");form.Add(bytes,"file","fixture.png");request.Content=form;}
                    using var response=await http.SendAsync(request);var json=await response.Content.ReadAsStringAsync();
                    var executive=path.EndsWith("/executive");var chatBusiness=path.EndsWith("/ask")&&mode=="invalid-business-json";
                    var expected=mode=="timeout"?504:executive||chatBusiness?200:502;
                    bool circuit=mode=="provider500"&&(int)response.StatusCode==503&&json.Contains("AI_PROVIDER_UNAVAILABLE");
                    check((int)response.StatusCode==expected||circuit,"controlled "+mode+" "+path.Split('?')[0]+" HTTP contract");
                    if(executive&&mode!="invalid-business-json")
                    {using var doc=JsonDocument.Parse(json);check(!doc.RootElement.GetProperty("data").GetProperty("aiInsight").GetProperty("aiAvailable").GetBoolean()||chatBusiness,"executive failure retains core data and reports unavailable");}
                    check(!json.Contains("F1-controlled-fixture-only")&&!json.Contains("StackTrace")&&!json.Contains("AIza"),"dependency response contains no key/stacktrace");
                }
            }
        }
        finally{if(!host.HasExited)host.Kill(true);await host.WaitForExitAsync();await File.WriteAllTextAsync(Path.Combine(report,"controlled-host.log"),await stdout+await stderr);}
    }
    sealed class Gateway:IDisposable
    {
        readonly TcpListener server=new(IPAddress.Loopback,0);readonly CancellationTokenSource cts=new();readonly Task loop;
        public int Status=200;public string Body="{}";public int DelayMilliseconds;
        public string Url {get;}
        public Gateway(){server.Start();Url=$"http://127.0.0.1:{((IPEndPoint)server.LocalEndpoint).Port}/v1beta";loop=Loop();}
        async Task Loop()
        {
            try{while(!cts.IsCancellationRequested){var client=await server.AcceptTcpClientAsync(cts.Token);_ = Respond(client);}}catch(OperationCanceledException){}catch(ObjectDisposedException){}
        }
        async Task Respond(TcpClient client)
        {
            using(client)
            {
                try{
                    var stream=client.GetStream();var header=new List<byte>();var one=new byte[1];
                    while(header.Count<65536&&await stream.ReadAsync(one,cts.Token)>0){header.Add(one[0]);if(header.Count>=4&&header.TakeLast(4).SequenceEqual(new byte[]{13,10,13,10}))break;}
                    var text=Encoding.ASCII.GetString(header.ToArray());var lengthLine=text.Split("\r\n").FirstOrDefault(x=>x.StartsWith("Content-Length:",StringComparison.OrdinalIgnoreCase));
                    if(lengthLine!=null){var left=int.Parse(lengthLine.Split(':')[1]);var buffer=new byte[8192];while(left>0){var count=await stream.ReadAsync(buffer.AsMemory(0,Math.Min(left,buffer.Length)),cts.Token);if(count==0)break;left-=count;}}
                    var body=Encoding.UTF8.GetBytes(Body);var status=Status;var delay=DelayMilliseconds;
                    if(delay>0)await Task.Delay(delay,cts.Token);
                    var response=Encoding.ASCII.GetBytes($"HTTP/1.1 {status} Fixture\r\nContent-Type: application/json\r\nContent-Length: {body.Length}\r\nConnection: close\r\n\r\n");
                    await stream.WriteAsync(response,cts.Token);await stream.WriteAsync(body,cts.Token);
                }catch(Exception ex)when(ex is IOException or OperationCanceledException or ObjectDisposedException){}
            }
        }
        public void Dispose(){cts.Cancel();server.Stop();loop.GetAwaiter().GetResult();cts.Dispose();}
    }
}
