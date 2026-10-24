using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using SmartWMS.Application.Common.Exceptions;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Features.Products.Commands.Create;
using SmartWMS.Application.Features.Products.DTOs.Commands;
using SmartWMS.Infrastructure.Persistence.DbContext;
using SmartWMS.Infrastructure.Persistence.Repositories;

static class EmbeddingChecks
{
    sealed class Probe(Func<CancellationToken,Task<float[]>> run):IEmbeddingService
    {
        public int Calls;
        public Task<float[]> GenerateEmbeddingAsync(string text)=>GenerateEmbeddingAsync(text,default);
        public Task<float[]> GenerateEmbeddingAsync(string text,CancellationToken ct){Calls++;return run(ct);}
        public double CalculateCosineSimilarity(float[] a,float[] b)=>0;
    }
    public static async Task Run(Action<bool,string> check)
    {
        await using var fixture=new FixtureDatabase("H2 enrichment failure/cancellation boundaries; real SQL, no network");
        ApplicationDbContext Db()=>new(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(fixture.Connection).Options,new FixtureUser());
        await using(var db=Db())await db.Database.MigrateAsync();
        const string key="SmartWMS_Product_Embeddings_Registry";
        var cases=new Dictionary<string,Func<CancellationToken,Task<float[]>>>
        {
            ["valid"]=ct=>Task.FromResult(DeterministicProvider.Vector()),
            ["null"]=ct=>Task.FromResult<float[]>(null!),["empty"]=ct=>Task.FromResult(Array.Empty<float>()),
            ["wrong-dimension"]=ct=>Task.FromResult(new float[]{1,2}),["zero"]=ct=>Task.FromResult(new float[768]),
            ["nan"]=ct=>Task.FromResult(Enumerable.Repeat(float.NaN,768).ToArray()),["infinity"]=ct=>Task.FromResult(Enumerable.Repeat(float.PositiveInfinity,768).ToArray()),
            ["configuration"]=ct=>Task.FromException<float[]>(new AiDependencyException("AI_CONFIGURATION_MISSING")),
            ["invalid-response"]=ct=>Task.FromException<float[]>(new AiDependencyException("AI_RESPONSE_INVALID")),
            ["circuit"]=ct=>Task.FromException<float[]>(new AiDependencyException("AI_PROVIDER_UNAVAILABLE")),
            ["http"]=ct=>Task.FromException<float[]>(new HttpRequestException("synthetic provider failure")),
            ["timeout"]=ct=>Task.FromException<float[]>(new TimeoutException()),
            ["provider-cancellation"]=ct=>Task.FromException<float[]>(new OperationCanceledException())
        };
        foreach(var pair in cases)
        {
            await using var db=Db();using var cache=new MemoryCache(new MemoryCacheOptions());cache.Set(key,new object());
            var probe=new Probe(pair.Value);var handler=new CreateProductCommandHandler(new UnitOfWork(db),probe,cache);
            var req=new CreateProductCommand(new CreateProductRequest{SKU="H2_BOUNDARY_"+pair.Key,Barcode="H2_BOUNDARY_"+pair.Key,Name="Boundary"});
            var result=await handler.Handle(req,default);
            check(result.IsSuccess,"core create succeeds "+pair.Key);
            var p=await db.Products.AsNoTracking().SingleAsync(x=>x.Id==result.Data);
            check(pair.Key=="valid"?p.DescriptionEmbeddingJson!=null:p.DescriptionEmbeddingJson==null,"no fake or invalid stored vector "+pair.Key);
            check(!cache.TryGetValue(key,out _),"registry invalidated after successful core save "+pair.Key);
            var calls=probe.Calls;var before=await FixtureDatabase.Snapshot(fixture.Connection);
            check(!(await handler.Handle(req,default)).IsSuccess&&calls==probe.Calls,"duplicate rejected before enrichment "+pair.Key);
            check(before==await FixtureDatabase.Snapshot(fixture.Connection),"duplicate preserves all SQL "+pair.Key);
        }
        foreach(var failure in new[]{"caller-cancel","unexpected"})
        {
            await using var db=Db();using var cache=new MemoryCache(new MemoryCacheOptions());using var cts=new CancellationTokenSource();
            cache.Set(key,"keep");var before=await FixtureDatabase.Snapshot(fixture.Connection);
            var probe=new Probe(ct=>{if(failure=="caller-cancel"){cts.Cancel();return Task.FromCanceled<float[]>(ct);}throw new InvalidOperationException("unexpected programming failure");});
            var handler=new CreateProductCommandHandler(new UnitOfWork(db),probe,cache);bool observed=false;
            try{await handler.Handle(new(new CreateProductRequest{SKU="H2_"+failure,Name="No commit"}),cts.Token);}
            catch(OperationCanceledException)when(failure=="caller-cancel"){observed=true;}
            catch(InvalidOperationException)when(failure=="unexpected"){observed=true;}
            check(observed,"does not swallow "+failure);
            check(before==await FixtureDatabase.Snapshot(fixture.Connection),"no persistence on "+failure);
            check(cache.TryGetValue(key,out _),"failed create does not evict valid registry "+failure);
        }
    }
}
