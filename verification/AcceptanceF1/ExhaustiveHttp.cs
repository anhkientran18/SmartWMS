using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Infrastructure.Persistence.DbContext;

static class ExhaustiveHttp
{
    static readonly string[] Capabilities=["Embedding","Chat","Forecast","Executive","Slotting","Semantic","OCR","Damage"];
    public static async Task Run(string connection,string api,string password,string report,string sku,Guid zone,Action<bool,string> check)
    {
        ApplicationDbContext Db()=>new(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(connection).Options,new FixtureUser());
        var folder=Path.Combine(report,"exhaustive");Directory.CreateDirectory(folder);
        using var provider=new DeterministicProvider();
        await using var host=await TestHost.Boot(api,connection,provider.Url,Path.Combine(folder,"main"));await host.Login("Admin",password);
        var records=new List<object>();
        async Task Verify(TestHost h,string cap,string mode,int expected,bool stateCheck=true)
        {
            var before=stateCheck?await FixtureDatabase.Snapshot(connection):"";
            long productsBefore=0,auditsBefore=0;
            if(cap=="Embedding"&&expected==200){await using var db=Db();productsBefore=await db.Products.LongCountAsync();auditsBefore=await db.AuditLogs.LongCountAsync();}
            using var request=Request(cap,sku,zone);using var response=await h.Http.SendAsync(request);
            var text=await response.Content.ReadAsStringAsync();var code=(int)response.StatusCode;
            check(code==expected,$"boundary {cap} {mode} HTTP{expected} actual{code}");
            lock(records)records.Add(new{capability=cap,scenario=mode,status=code,expected});
            check(!text.Contains("F1-deterministic-only")&&!text.Contains("StackTrace")&&!text.Contains("not-json"),$"boundary {cap} {mode} safe envelope");
            using var document=JsonDocument.Parse(text);var j=document.RootElement;
            if(expected==200)
            {
                check(j.GetProperty("isSuccess").GetBoolean(),$"boundary {cap} {mode} isSuccess true");
                var data=cap=="Damage"?j.GetProperty("analysis"):j.GetProperty("data");
                if(cap=="Executive")
                {
                    await using var db=Db();var bins=await db.Bins.Where(x=>!x.IsDeleted).ToListAsync();var insight=data.GetProperty("aiInsight");
                    check(insight.GetProperty("totalProducts").GetInt32()==await db.Products.CountAsync(x=>!x.IsDeleted)&&insight.GetProperty("totalBins").GetInt32()==bins.Count,
                        "executive "+mode+" authoritative core product/bin counts retained");
                    var expectedRate=Math.Round(bins.Sum(x=>x.CurrentOccupancy)/bins.Sum(x=>x.MaxCapacity)*100,2);
                    check(insight.GetProperty("overallOccupancyPercentage").GetDouble()==expectedRate&&data.TryGetProperty("inventory",out _)&&data.TryGetProperty("warehouse",out _),"executive "+mode+" occupancy and core KPI envelope");
                    bool success=mode=="success";
                    check(insight.GetProperty("aiAvailable").GetBoolean()==success,"executive "+mode+" explicit AI availability");
                    if(!success)check(insight.GetProperty("aiErrorCode").GetString()=="AI_UNAVAILABLE"&&insight.GetProperty("aiExecutiveSummary").GetString()=="","executive "+mode+" truthful fallback code/empty summary");
                }
                else if(cap=="Embedding")
                {
                    var id=data.GetGuid();await using var db=Db();var product=await db.Products.FindAsync(id);
                    check(product!=null&&JsonSerializer.Deserialize<float[]>(product.DescriptionEmbeddingJson!)!.Length==768,"embedding success persists exact API product and768 vector");
                    check(await db.Products.LongCountAsync()==productsBefore+1&&await db.AuditLogs.LongCountAsync()>auditsBefore&&
                        !await db.BinInventories.AnyAsync(x=>x.ProductId==id),"embedding success creates exactly one catalog row, new audit and no inventory rows");
                }
                else if(cap=="Chat")check(!string.IsNullOrWhiteSpace(data.GetString()),"chat success nonempty text");
                else if(cap=="Forecast")check(data.GetProperty("sku").GetString()==sku&&data.GetProperty("historicalMovements").GetArrayLength()>0&&data.GetProperty("forecastedDemand").GetArrayLength()>0,"forecast success structured authoritative contract");
                else if(cap=="Slotting")check(data.GetArrayLength()==1&&data[0].GetProperty("sku").GetString()==sku,"slotting success actual scoped identity");
                else if(cap=="Semantic")check(data.ValueKind==JsonValueKind.Array&&data.GetArrayLength()>=2,"semantic success real active fixture IDs");
                else if(cap=="OCR")check(data.GetProperty("Items")[0].GetProperty("Quantity").GetInt32()>0,"OCR success validated line quantities");
                else if(cap=="Damage")check(data.GetProperty("Severity").GetString()=="Low","damage success validated severity");
            }
            else
            {
                check((j.TryGetProperty("status",out var status)&&status.GetInt32()==expected)||(j.TryGetProperty("isSuccess",out var success)&&!success.GetBoolean()),$"boundary {cap} {mode} ProblemDetails/business error contract");
                if(mode=="circuit-open")check(j.GetProperty("code").GetString()=="AI_PROVIDER_UNAVAILABLE","circuit-open exact503 code "+cap);
                if(mode=="missing-model")check(j.GetProperty("code").GetString()=="AI_CONFIGURATION_MISSING","missing model exact503 code "+cap);
            }
            if(stateCheck)check(before==await FixtureDatabase.Snapshot(connection),$"boundary {cap} {mode} complete SQL state unchanged");
        }
        // Controlled success is explicitly separate from preserved live89/93 evidence.
        foreach(var cap in Capabilities)await Verify(host,cap,"success",200,cap!="Embedding");
        foreach(var mode in new[]{"http-400","http-401","http-403","http-404","invalid-json","empty","empty-text","business-invalid"})
        {
            provider.Mode=mode;
            foreach(var cap in Capabilities)
            {
                // Embeddings have no text field: exercise its empty vector rather than unrelated text envelopes.
                if(cap is "Embedding" or "Semantic" && mode=="empty-text")provider.Mode="empty-vector";
                await Verify(host,cap,mode,cap=="Executive"?200:502);provider.Mode=mode;
            }
        }
        // Retry policies stay production-real. Parallel requests avoid serial14s waits for shared429 tests.
        foreach(var mode in new[]{"http-429","timeout"})
        {
            provider.Mode=mode;var before=await FixtureDatabase.Snapshot(connection);
            var outcomes=await Task.WhenAll(Capabilities.Select(async cap=>
            {using var req=Request(cap,sku,zone);using var res=await host.Http.SendAsync(req);return(cap,code:(int)res.StatusCode,body:await res.Content.ReadAsStringAsync());}));
            foreach(var x in outcomes)
            {
                int expected=x.cap=="Executive"?200:mode=="timeout"?504:502;
                check(x.code==expected,$"boundary {x.cap} {mode} expected{expected} actual{x.code}");records.Add(new{capability=x.cap,scenario=mode,status=x.code,expected});
                using var doc=JsonDocument.Parse(x.body);var j=doc.RootElement;
                if(x.cap=="Executive")check(!j.GetProperty("data").GetProperty("aiInsight").GetProperty("aiAvailable").GetBoolean()&&j.GetProperty("data").GetProperty("aiInsight").GetProperty("aiErrorCode").GetString()=="AI_UNAVAILABLE","executive "+mode+" fallback correct");
                else check(j.GetProperty("status").GetInt32()==expected,"ProblemDetails "+x.cap+" "+mode);
            }
            check(before==await FixtureDatabase.Snapshot(connection),mode+" parallel8 capability failures leave complete SQL state unchanged");
        }
        provider.Mode="timeout";var beforeCancel=await FixtureDatabase.Snapshot(connection);
        using(var cts=new CancellationTokenSource(150))
        {bool canceled=false;try{using var req=Request("Executive",sku,zone);using var res=await host.Http.SendAsync(req,cts.Token);}catch(OperationCanceledException){canceled=true;}check(canceled,"executive caller cancellation is not received as fallback success");}
        check(beforeCancel==await FixtureDatabase.Snapshot(connection),"caller cancellation no SQL mutation");provider.Mode="success";
        await Uploads(host,connection,provider,check);
        await AuthorizationChecks.Run(host,connection,password,sku,zone,folder,check);
        await host.Login("Admin",password); // Authorization matrix intentionally ends with Staff.
        // Empty production model settings never use Development JSON or a preview fallback.
        using(var missingProvider=new DeterministicProvider())
        {
            await using var missing=await TestHost.Boot(api,connection,missingProvider.Url,Path.Combine(folder,"missing"),missingModels:true);await missing.Login("Admin",password);
            foreach(var cap in Capabilities)await Verify(missing,cap,"missing-model",cap=="Executive"?200:503);
            check(missingProvider.Observed.IsEmpty,"production missing models make zero provider calls");
        }
        using(var invalidProvider=new DeterministicProvider())
        {
            await using var invalid=await TestHost.Boot(api,connection,invalidProvider.Url,Path.Combine(folder,"invalid-model"),invalidModel:true);await invalid.Login("Admin",password);
            foreach(var cap in Capabilities)await Verify(invalid,cap,"invalid-model404",cap=="Executive"?200:502);
        }
        // Each capability gets a fresh policy instance for500/503: do not mislabel an already-open circuit as a provider response.
        foreach(var statusCode in new[]{500,503})
        {
            using var limit=new SemaphoreSlim(2);
            await Task.WhenAll(Capabilities.Select(async cap=>
            {
                await limit.WaitAsync();try
                {
                    using var failedProvider=new DeterministicProvider{Mode="http-"+statusCode};
                    await using var failed=await TestHost.Boot(api,connection,failedProvider.Url,Path.Combine(folder,$"provider-{statusCode}-{cap}"));await failed.Login("Admin",password);
                    await Verify(failed,cap,"http-"+statusCode,cap=="Executive"?200:502);
                    check(failedProvider.Observed.Count==4,$"{cap} provider{statusCode} observed initial+3 actual retry attempts");
                }finally{limit.Release();}
            }));
        }
        provider.Mode="http-500";
        for(int i=0;i<2;i++){using var req=Request("Chat",sku,zone);using var res=await host.Http.SendAsync(req);}
        for(int i=0;i<2;i++){using var req=Request("Embedding",sku,zone);using var res=await host.Http.SendAsync(req);}
        foreach(var cap in Capabilities)await Verify(host,cap,"circuit-open",cap=="Executive"?200:503);
        await File.WriteAllTextAsync(Path.Combine(folder,"boundary-matrix.json"),JsonSerializer.Serialize(records,new JsonSerializerOptions{WriteIndented=true}));
    }
    internal static HttpRequestMessage Request(string cap,string sku,Guid zone)
    {
        var path=cap switch{"Chat"=>"/api/v1/Chat/ask","Forecast"=>"/api/v1/Forecasts/demand-prediction?sku="+sku,"Executive"=>"/api/v1/Dashboard/executive","Slotting"=>"/api/v1/Dashboard/ai-slotting-recommendations?zoneId="+zone,"Semantic"=>"/api/v1/Products/semantic-search?text=warehouse%20stock","Embedding"=>"/api/v1/Products","OCR"=>"/api/v1/InboundReceipts/scan-invoice",_=>"/api/v1/InboundReceipts/report-damage"};
        var r=new HttpRequestMessage(cap is "Chat" or "Embedding" or "OCR" or "Damage"?HttpMethod.Post:HttpMethod.Get,path);
        if(cap=="Chat")r.Content=JsonContent.Create(new{message="Deterministic acceptance: explain stock verification without executing actions."});
        if(cap=="Embedding")r.Content=JsonContent.Create(new{sku="F1_BOUNDARY_"+Guid.NewGuid().ToString("N"),barcode=Guid.NewGuid().ToString("N"),name="Boundary product",description="Fixture only",unit="Pcs",trackingMode=0});
        if(cap is "OCR" or "Damage")r.Content=Image("invoice.png","image/png",Fixture("invoice.png"));
        return r;
    }
    static byte[] Fixture(string name)=>File.ReadAllBytes(Path.Combine(Environment.GetEnvironmentVariable("F1_REPO")!,"verification/AcceptanceF1/fixtures",name));
    internal static MultipartFormDataContent Image(string filename,string mime,byte[] bytes)
    {var form=new MultipartFormDataContent();var file=new ByteArrayContent(bytes);file.Headers.ContentType=new(mime);form.Add(file,"file",filename);return form;}
    static async Task Uploads(TestHost host,string connection,DeterministicProvider provider,Action<bool,string> check)
    {
        provider.Mode="success";var before=await FixtureDatabase.Snapshot(connection);
        foreach(var action in new[]{"scan-invoice","report-damage"})
        {
            var cases=new List<(string name,string file,string mime,byte[] bytes,int status)>{
                ("valid PNG","invoice.png","image/png",Fixture("invoice.png"),200),("valid JPEG","invoice.jpg","image/jpeg",Fixture("invoice.jpg"),200),("valid WebP","invoice.webp","image/webp",Fixture("invoice.webp"),200),
                ("empty","empty.png","image/png",[],400),("size","large.png","image/png",new byte[5*1024*1024+1],400),("extension","bad.exe","image/png",Fixture("invoice.png"),400),
                ("MIME mismatch","bad.png","image/jpeg",Fixture("invoice.png"),400),("fake PNG","bad.png","image/png",[137,80,78,70,13,10,26,10,0],400),("fake JPEG","bad.jpg","image/jpeg",[255,216,0,0],400),("fake WebP","bad.webp","image/webp",System.Text.Encoding.ASCII.GetBytes("RIFF0000FAKE0000"),400),
                ("traversal","../f1-no-overwrite.png","image/png",Fixture("invoice.png"),400),("backslash traversal","..\\f1-no-overwrite.png","image/png",Fixture("invoice.png"),400),("double extension","bad.png.exe","image/png",Fixture("invoice.png"),400),("uppercase","GOOD.PNG","image/png",Fixture("invoice.png"),200)};
            foreach(var c in cases)
            {using var form=Image(c.file,c.mime,c.bytes);using var response=await host.Http.PostAsync("/api/v1/InboundReceipts/"+action,form);var text=await response.Content.ReadAsStringAsync();check((int)response.StatusCode==c.status,$"upload {action} {c.name} expected{c.status}");check(!text.Contains("F1-deterministic-only")&&!text.Contains("RawOutput"),"upload no key/raw provider payload leakage");}
        }
        check(before==await FixtureDatabase.Snapshot(connection),"all valid/rejected uploads preserve complete SQL state");
        var repo=Environment.GetEnvironmentVariable("F1_REPO")!;
        var uploadArea=Directory.GetParent(host.Start.WorkingDirectory)!.FullName;
        check(!File.Exists(Path.Combine(repo,"f1-no-overwrite.png"))&&
            !Directory.EnumerateFiles(uploadArea,"*",SearchOption.AllDirectories).Any(x=>new[]{".png",".jpg",".webp"}.Contains(Path.GetExtension(x).ToLowerInvariant())),
            "valid/traversal client filenames never become files in the host directory or its parent");
    }
}
