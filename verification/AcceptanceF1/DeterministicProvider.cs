using System.Collections.Concurrent;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;

// Explicit test double. No response from this server is live Gemini certification.
sealed class DeterministicProvider : IDisposable
{
    readonly TcpListener server=new(IPAddress.Loopback,0);
    readonly CancellationTokenSource stop=new(); readonly Task loop;
    readonly ConcurrentBag<Task> requests=new();
    public readonly ConcurrentQueue<(string Path,string Prompt)> Observed=new();
    public string Mode="success";
    public string Url {get;}
    public DeterministicProvider(){server.Start();Url=$"http://127.0.0.1:{((IPEndPoint)server.LocalEndpoint).Port}/v1beta";loop=Loop();}
    async Task Loop()
    {
        try{while(!stop.IsCancellationRequested){var client=await server.AcceptTcpClientAsync(stop.Token);requests.Add(Respond(client));}}
        catch(Exception ex)when(ex is OperationCanceledException or ObjectDisposedException){}
    }
    async Task Respond(TcpClient client)
    {
        using(client)
        try
        {
            var stream=client.GetStream();var header=new List<byte>();var one=new byte[1];
            while(header.Count<65536&&await stream.ReadAsync(one,stop.Token)>0){header.Add(one[0]);if(header.Count>=4&&header.TakeLast(4).SequenceEqual(new byte[]{13,10,13,10}))break;}
            var headers=Encoding.ASCII.GetString(header.ToArray());var path=headers.Split(' ')[1];
            var length=headers.Split("\r\n").FirstOrDefault(x=>x.StartsWith("Content-Length:",StringComparison.OrdinalIgnoreCase));
            var bytes=new byte[length==null?0:int.Parse(length.Split(':')[1])];int read=0;
            while(read<bytes.Length){var count=await stream.ReadAsync(bytes.AsMemory(read),stop.Token);if(count==0)break;read+=count;}
            using var doc=JsonDocument.Parse(bytes);var root=doc.RootElement;
            bool embedding=path.EndsWith(":embedContent");
            var prompt=embedding?root.GetProperty("content").GetProperty("parts")[0].GetProperty("text").GetString()!:
                root.GetProperty("contents")[0].GetProperty("parts")[0].GetProperty("text").GetString()!;
            Observed.Enqueue((path,prompt));
            var mode=Mode;int status=mode.StartsWith("http-")?int.Parse(mode[5..]):path.Contains("bad-model")?404:200;
            if(mode=="timeout")await Task.Delay(35000,stop.Token);
            string payload;
            if(mode=="invalid-json")payload="not-json";
            else if(mode=="empty")payload="";
            else if(embedding)payload=JsonSerializer.Serialize(new{embedding=new{values=mode=="empty-vector"?Array.Empty<float>():mode=="business-invalid"?new float[]{1,2}:Vector()}});
            else
            {
                var text=mode=="empty-text"?" ":Text(prompt,mode=="business-invalid");
                payload=JsonSerializer.Serialize(new{candidates=new[]{new{content=new{parts=new[]{new{text}}}}}});
            }
            var body=Encoding.UTF8.GetBytes(payload);var response=Encoding.ASCII.GetBytes($"HTTP/1.1 {status} Fixture\r\nContent-Type: application/json\r\nContent-Length: {body.Length}\r\nConnection: close\r\n\r\n");
            await stream.WriteAsync(response,stop.Token);await stream.WriteAsync(body,stop.Token);
        }
        catch(Exception ex)when(ex is IOException or OperationCanceledException or ObjectDisposedException or JsonException){}
    }
    public static float[] Vector(){var v=new float[768];v[0]=1;return v;}
    static string Text(string prompt,bool invalid)
    {
        if(prompt.Contains("lịch sử xuất kho 90"))
        {
            using var d=FirstObject(prompt);var p=d.RootElement;
            return JsonSerializer.Serialize(new{SKU=invalid?"HALLUCINATED":p.GetProperty("SKU").GetString(),HistoricalMovements=Array.Empty<object>(),ForecastedDemand=new[]{new{Date=p.GetProperty("ForecastStartDate").GetString(),Quantity=3}}});
        }
        if(prompt.Contains("Slotting Optimization"))
        {
            using var d=FirstObject(prompt);var p=d.RootElement.GetProperty("Products")[0];var zone=p.GetProperty("CurrentZones")[0].GetString();
            return JsonSerializer.Serialize(new[]{new{SKU=invalid?"HALLUCINATED":p.GetProperty("SKU").GetString(),ProductName=p.GetProperty("Name").GetString(),CurrentZone=zone,SuggestedZone=zone,VelocityClass="Fast",AIReasoning="Deterministic advisory"}});
        }
        if(prompt.Contains("SupplierName"))return JsonSerializer.Serialize(new{SupplierName="F1 Supplier",InvoiceNumber="INV-F1",InvoiceDate="2026-10-23",Items=new[]{new{SKU="F1-ITEM",ProductName="Component",Quantity=invalid?-1:2,UnitPrice=10}}});
        if(prompt.Contains("DamageType"))return JsonSerializer.Serialize(new{DamageType="Carton",Severity=invalid?"Critical":"Low",DamageDescription="Synthetic damaged carton",ActionRecommended="Inspect manually"});
        return invalid?" ":"Deterministic warehouse guidance; no action executed.";
    }
    static JsonDocument FirstObject(string text)
    {
        var reader=new Utf8JsonReader(Encoding.UTF8.GetBytes(text[text.IndexOf('{')..]));return JsonDocument.ParseValue(ref reader);
    }
    public void Dispose(){stop.Cancel();server.Stop();loop.GetAwaiter().GetResult();Task.WhenAll(requests).GetAwaiter().GetResult();stop.Dispose();}
}
