using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models.Configurations;
using SmartWMS.Application.Features.Dashboard.DTOs.Queries;
using SmartWMS.Application.Features.Dashboard.Queries.GetDashboardInsightQuery;
using SmartWMS.Application.Features.Forecasts.DTOs.Queries;
using SmartWMS.Application.Features.Forecasts.Queries.GetStockForecast;
using SmartWMS.Application.Features.InventoryManagement.DTOs.Queries;
using SmartWMS.Application.Features.InventoryManagement.Queries.GetSlottingRecommendations;
using SmartWMS.Application.Features.Products.DTOs.Queries;
using SmartWMS.Application.Features.Products.Models;
using SmartWMS.Application.Features.Products.Queries.GetSemanticProducts;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums;
using SmartWMS.Infrastructure.Persistence.DbContext;
using SmartWMS.Infrastructure.Persistence.Repositories;
using SmartWMS.Infrastructure.Services;

static class DeepDataChecks
{
    public static async Task Run(Action<bool,string> check)
    {
        await using var fixture=new FixtureDatabase("Exhaustive SQL AI data scope; inactive means IsDeleted in current schema");
        await using var db=new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(fixture.Connection).Options,new FixtureUser());await db.Database.MigrateAsync();
        var wh=new Warehouse{Code="DD-W",Name="Warehouse A"};var foreign=new Warehouse{Code="DD-F",Name="Warehouse B"};
        var zone=new Zone{Code="DD-Z",Name="Scope",Warehouse=wh};var outside=new Zone{Code="DD-O",Name="Outside",Warehouse=wh};var alien=new Zone{Code="DD-A",Name="Foreign",Warehouse=foreign};var deletedZone=new Zone{Code="DD-DZ",Name="Inactive zone",Warehouse=wh,IsDeleted=true};
        db.Zones.AddRange(zone,outside,alien,deletedZone);
        var main=new Product{SKU="DD-MAIN",Barcode="DD-MAIN",Name="Main",Description="Old description"};var onlyOutside=new Product{SKU="DD-OUTSIDE",Barcode="DD-OUTSIDE",Name="Outside only"};var inactive=new Product{SKU="DD-DELETED",Barcode="DD-DELETED",Name="Inactive",IsDeleted=true};
        var deadBinProduct=new Product{SKU="DD-DEADBIN",Barcode="DD-DEADBIN",Name="Inactive bin"};var deadZoneProduct=new Product{SKU="DD-DEADZONE",Barcode="DD-DEADZONE",Name="Inactive zone"};var empty=new Product{SKU="DD-EMPTY",Barcode="DD-EMPTY",Name="No history"};var huge=new Product{SKU="DD-HUGE",Barcode="DD-HUGE",Name="Long-safe"};var exact=new Product{SKU="DD-EXACT",Barcode="DD-EXACT",Name="Int max"};
        db.Products.AddRange(empty,huge,exact);
        var bin=new Bin{Code="DD-B",Zone=zone,MaxCapacity=100,CurrentOccupancy=20};var outsideBin=new Bin{Code="DD-OB",Zone=outside,MaxCapacity=100,CurrentOccupancy=20};var deadBin=new Bin{Code="DD-DB",Zone=zone,MaxCapacity=100,CurrentOccupancy=10,IsDeleted=true};var dzBin=new Bin{Code="DD-DZB",Zone=deletedZone,MaxCapacity=100,CurrentOccupancy=10};
        foreach(var pair in new[]{(bin,main),(bin,inactive),(outsideBin,main),(outsideBin,onlyOutside),(deadBin,deadBinProduct),(dzBin,deadZoneProduct)})db.BinInventories.Add(new BinInventory{Bin=pair.Item1,Product=pair.Item2,Quantity=10,Status=InventoryStatus.Available});
        await db.SaveChangesAsync();
        async Task History(Product p,string type,int q,int days,string source)
        {
            var t=new InventoryTransaction{Id=Guid.NewGuid(),ProductId=p.Id,TransactionType=type,QuantityChanged=q,SourceBinCode=source,DestinationBinCode="N/A",ReasonCode="DD",CreatedBy="DD"};db.InventoryTransactions.Add(t);await db.SaveChangesAsync();
            var at=DateTime.UtcNow.Date.AddDays(days).AddHours(1);await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE InventoryTransactions SET CreatedAt={at} WHERE Id={t.Id}");
        }
        await History(main,"OUTBOUND",-2,-2,bin.Code);await History(main,"WAVE_OUTBOUND",-3,-2,bin.Code);await History(main,"OUTBOUND_SERIAL",-4,-2,bin.Code);await History(main,"OUTBOUND",-8,-2,outsideBin.Code);
        await History(main,"OUTBOUND",-6,-45,bin.Code);await History(main,"OUTBOUND",-100,-91,bin.Code);await History(main,"OUTBOUND",-100,1,bin.Code);await History(main,"TRANSFER",-100,-2,bin.Code);await History(main,"OUTBOUND",100,-2,bin.Code);await History(main,"ADJUSTMENT",-100,-2,bin.Code);
        foreach(var p in new[]{onlyOutside,inactive,deadBinProduct,deadZoneProduct})await History(p,"OUTBOUND",-77,-2,p==onlyOutside?outsideBin.Code:bin.Code);
        await History(huge,"OUTBOUND",-1_500_000_000,-2,bin.Code);await History(huge,"OUTBOUND",-1_500_000_000,-2,bin.Code);await History(exact,"OUTBOUND",-int.MaxValue,-2,bin.Code);
        var ai=new Probe();var forecast=new GetStockForecastQueryHandler(db,ai);var slotting=new GetSlottingRecommendationsQueryHandler(db,ai);var before=await FixtureDatabase.Snapshot(fixture.Connection);
        string Forecast(string sku,object[]? points=null)=>JsonSerializer.Serialize(new{SKU=sku,HistoricalMovements=Array.Empty<object>(),ForecastedDemand=points??[new{Date=DateTime.UtcNow.Date.AddDays(1),Quantity=1}]});
        ai.Response=Forecast(main.SKU);var f=await forecast.Handle(new(new StockForecastRequest{Sku=main.SKU}),default);
        check(f.IsSuccess&&f.Data!.HistoricalMovements.Sum(x=>x.Quantity)==23&&f.Data.HistoricalMovements.Count==2,"deep forecast authoritative total23 across2 dates, duplicate date aggregate17");
        using(var p=JsonDocument.Parse(ai.Payload))check(p.RootElement.GetProperty("History").EnumerateArray().Sum(x=>x.GetProperty("TotalPickedQty").GetInt64())==23,"deep forecast input excludes positive/non-outbound/old/future; includes three outbound types");
        foreach(var p in new[]{inactive,empty})check(!(await forecast.Handle(new(new StockForecastRequest{Sku=p.SKU}),default)).IsSuccess,"deep forecast rejects inactive/no-history "+p.SKU);
        check(!(await forecast.Handle(new(new StockForecastRequest{Sku="MISSING"}),default)).IsSuccess,"deep forecast missing SKU");
        var calls=ai.Calls;check(!(await forecast.Handle(new(new StockForecastRequest{Sku=huge.SKU}),default)).IsSuccess&&ai.Calls==calls,"long-safe SUM3b rejects DTO overflow before provider, no SQL int overflow");
        ai.Response=Forecast(exact.SKU);var max=await forecast.Handle(new(new StockForecastRequest{Sku=exact.SKU}),default);check(max.IsSuccess&&max.Data!.HistoricalMovements.Single().Quantity==int.MaxValue,"exact int max daily aggregate accepted");
        var day=DateTime.UtcNow.Date;
        var invalidForecasts=new Dictionary<string,string>{["wrong SKU"]=Forecast("WRONG"),["duplicate dates"]=Forecast(main.SKU,[new{Date=day.AddDays(1),Quantity=1},new{Date=day.AddDays(1),Quantity=2}]),["negative quantity"]=Forecast(main.SKU,[new{Date=day.AddDays(1),Quantity=-1}]),["past"]=Forecast(main.SKU,[new{Date=day.AddDays(-1),Quantity=1}]),["today"]=Forecast(main.SKU,[new{Date=day,Quantity=1}]),["beyond horizon"]=Forecast(main.SKU,[new{Date=day.AddDays(31),Quantity=1}]),["malformed"]="{broken",["empty"]="",["null"]="null"};
        foreach(var pair in invalidForecasts){ai.Response=pair.Value;var result=await forecast.Handle(new(new StockForecastRequest{Sku=main.SKU}),default);check(!result.IsSuccess&&result.Error?.Code=="AI_RESPONSE_INVALID","deep forecast rejects "+pair.Key);}
        object Rec(string sku,string current,string suggested,string velocity="Fast")=>new{SKU=sku,CurrentZone=current,SuggestedZone=suggested,VelocityClass=velocity,AIReasoning="Fixture"};
        ai.Response=JsonSerializer.Serialize(new[]{Rec(main.SKU,zone.Name,outside.Name)});var s=await slotting.Handle(new(new SlottingRecommendationRequest{ZoneId=zone.Id}),default);
        check(s.IsSuccess&&s.Data!.Single().ProductName==main.Name,"slotting accepts actual scope/current zone and active same-warehouse destination");
        using(var p=JsonDocument.Parse(ai.Payload))
        {var products=p.RootElement.GetProperty("Products");var names=p.RootElement.GetProperty("AllowedZones").EnumerateArray().Select(x=>x.GetString()).ToArray();check(products.GetArrayLength()==1&&products[0].GetProperty("SKU").GetString()==main.SKU&&products[0].GetProperty("TotalPickedQty").GetInt64()==9,"slotting prompt excludes outside-only/inactive product/bin/zone and outside/old/future history");check(products[0].GetProperty("CurrentZones").GetArrayLength()==1&&!names.Contains(alien.Name)&&!names.Contains(deletedZone.Name),"mixed-location SKU only exposes requested-zone current location; foreign/inactive destinations excluded");}
        var badSlotting=new Dictionary<string,string>{["foreign warehouse"]=JsonSerializer.Serialize(new[]{Rec(main.SKU,zone.Name,alien.Name)}),["inactive suggested zone"]=JsonSerializer.Serialize(new[]{Rec(main.SKU,zone.Name,deletedZone.Name)}),["hallucinated SKU"]=JsonSerializer.Serialize(new[]{Rec("GHOST",zone.Name,zone.Name)}),["outside-only SKU"]=JsonSerializer.Serialize(new[]{Rec(onlyOutside.SKU,zone.Name,zone.Name)}),["outside current location"]=JsonSerializer.Serialize(new[]{Rec(main.SKU,outside.Name,zone.Name)}),["duplicate recommendation"]=JsonSerializer.Serialize(new[]{Rec(main.SKU,zone.Name,zone.Name),Rec(main.SKU,zone.Name,zone.Name)}),["invalid velocity"]=JsonSerializer.Serialize(new[]{Rec(main.SKU,zone.Name,zone.Name,"Unknown")})};
        foreach(var pair in badSlotting){ai.Response=pair.Value;check(!(await slotting.Handle(new(new SlottingRecommendationRequest{ZoneId=zone.Id}),default)).IsSuccess,"slotting rejects "+pair.Key);}
        calls=ai.Calls;check(!(await slotting.Handle(new(new SlottingRecommendationRequest{ZoneId=deletedZone.Id}),default)).IsSuccess&&ai.Calls==calls,"inactive requested zone rejects before provider");
        check(before==await FixtureDatabase.Snapshot(fixture.Connection),"deep forecast/slotting success and rejection entire DB unchanged");
        ai.BlockExecutive=true;
        using(var cts=new CancellationTokenSource(150))
        {bool canceled=false;try{await new GetDashboardInsightQueryHandler(db,ai).Handle(new(new DashboardInsightQueryRequest()),cts.Token);}catch(OperationCanceledException){canceled=true;}check(canceled&&ai.ExecutiveCancellation,"executive actual AI cancellation propagates and is not swallowed by fallback");}
        check(before==await FixtureDatabase.Snapshot(fixture.Connection),"deep executive caller-cancel complete DB unchanged");
        // Deliberately corrupt/stale registry tests in the current single-DB deployment.
        main.DescriptionEmbeddingJson=JsonSerializer.Serialize(DeterministicProvider.Vector());inactive.DescriptionEmbeddingJson=main.DescriptionEmbeddingJson;main.Name="Renamed current product";main.SKU="DD-CURRENT-SKU";main.Description="Current description";await db.SaveChangesAsync();
        using var cache=new MemoryCache(new MemoryCacheOptions());const string key="SmartWMS_Product_Embeddings_Registry";
        ProductVectorCacheModel Cached(Product p)=>new(){Id=p.Id,SKU="STALE-SKU",Name="STALE-NAME",Description="STALE-DESCRIPTION",Embedding=DeterministicProvider.Vector()};
        cache.Set(key,new List<ProductVectorCacheModel>{Cached(main),Cached(main),Cached(inactive)});var embedding=new EmbeddingProbe();var uow=new UnitOfWork(db);var semantic=new GetSemanticProductsQueryHandler(uow,embedding,cache);before=await FixtureDatabase.Snapshot(fixture.Connection);
        var resultSemantic=await semantic.Handle(new(new SemanticSearchProductRequest{SearchText="fixture"}),default);
        check(resultSemantic.IsSuccess&&resultSemantic.Data!.Count==1&&resultSemantic.Data!.Single().Id==main.Id,"semantic cache duplicate IDs deduplicated and deleted cached product removed");
        check(resultSemantic.Data!.Single().SKU==main.SKU&&resultSemantic.Data!.Single().Name==main.Name&&resultSemantic.Data!.Single().Description==main.Description,"semantic rehydrates renamed product/changed SKU/current description by ID");
        embedding.Vector=new float[768];embedding.Vector[1]=1;var noMatch=await semantic.Handle(new(new SemanticSearchProductRequest{SearchText="new description"}),default);check(noMatch.IsSuccess&&noMatch.Data!.Count==0,"semantic no matches and stale description-vector ranking limitation are explicit");
        embedding.Vector=DeterministicProvider.Vector();cache.Remove(key);var rebuilt=await semantic.Handle(new(new SemanticSearchProductRequest{SearchText="fixture"}),default);check(rebuilt.IsSuccess&&rebuilt.Data!.All(x=>x.Id!=inactive.Id),"semantic cache rebuild active-products specification excludes soft deleted rows");
        check(before==await FixtureDatabase.Snapshot(fixture.Connection),"all semantic cache/query cases complete DB unchanged");
        check(new GeminiSettings().DefaultModel==""&&new GeminiSettings().ProModel==""&&new GeminiSettings().EmbeddingModel=="","production options require explicit models and have no universal preview fallback");
    }
    sealed class EmbeddingProbe:IEmbeddingService
    {
        public float[] Vector=DeterministicProvider.Vector();
        public Task<float[]> GenerateEmbeddingAsync(string text)=>Task.FromResult(Vector);
        public double CalculateCosineSimilarity(float[] a,float[] b)=>new GeminiEmbeddingService(new HttpClient(),Options.Create(new GeminiSettings())).CalculateCosineSimilarity(a,b);
    }
    sealed class Probe:IAiInsightService
    {
        public string Response="{}",Payload="";public int Calls;public bool BlockExecutive,ExecutiveCancellation;
        public Task<string> PredictDemandAsync(string s){Calls++;Payload=s;return Task.FromResult(Response);}
        public Task<string> AnalyzeSlottingOptimizationAsync(string s){Calls++;Payload=s;return Task.FromResult(Response);}
        public Task<string> GenerateExecutiveInsightAsync(string s)=>Task.FromResult(Response);
        public async Task<string> GenerateExecutiveInsightAsync(string s,CancellationToken ct){if(BlockExecutive){try{await Task.Delay(Timeout.Infinite,ct);}catch(OperationCanceledException){ExecutiveCancellation=true;throw;}}return Response;}
        public Task<string> GenerateInsightAsync(string s)=>throw new NotSupportedException();public Task<string> AnalyzeReceiptImageAsync(byte[] a,string m)=>throw new NotSupportedException();public Task<string> AnalyzeDamageImageAsync(byte[] a,string m)=>throw new NotSupportedException();public Task<string> ParseVoiceCommandAsync(string s)=>throw new NotSupportedException();
    }
}
