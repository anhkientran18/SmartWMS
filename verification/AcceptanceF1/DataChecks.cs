using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Features.Forecasts.DTOs.Queries;
using SmartWMS.Application.Features.Forecasts.Queries.GetStockForecast;
using SmartWMS.Application.Features.InventoryManagement.DTOs.Queries;
using SmartWMS.Application.Features.InventoryManagement.Queries.GetSlottingRecommendations;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums;
using SmartWMS.Infrastructure.Persistence.DbContext;

static class DataChecks
{
    public static async Task Run(Action<bool,string> check)
    {
        await using var fixture=new FixtureDatabase("F1 AI input correctness with real SQL, controlled application boundary; not live provider evidence");
        await using var db=new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(fixture.Connection).Options,new FixtureUser());
        await db.Database.MigrateAsync();
        var warehouse=new Warehouse{Code="F1-DATA-W",Name="Data warehouse"};
        var zone=new Zone{Code="F1-DATA-Z",Name="Scoped",Warehouse=warehouse};var outside=new Zone{Code="F1-OUTSIDE",Name="Outside",Warehouse=warehouse};
        var bin=new Bin{Code="F1-DATA-B",Zone=zone,MaxCapacity=100,CurrentOccupancy=10};var otherBin=new Bin{Code="F1-OTHER-B",Zone=outside,MaxCapacity=100,CurrentOccupancy=10};
        var product=new Product{SKU="F1-DATA-P",Name="Scoped product",Barcode="F1-DATA-P"};var other=new Product{SKU="F1-OUTSIDE-P",Name="Outside product",Barcode="F1-OUTSIDE-P"};var empty=new Product{SKU="F1-EMPTY",Name="No demand",Barcode="F1-EMPTY"};
        db.Products.Add(empty);
        db.BinInventories.AddRange(new BinInventory{Bin=bin,Product=product,Quantity=10,Status=InventoryStatus.Available},new BinInventory{Bin=otherBin,Product=other,Quantity=10,Status=InventoryStatus.Available});
        await db.SaveChangesAsync();
        async Task History(Product p,string type,int q,int days,string source)
        {
            var t=new InventoryTransaction{Id=Guid.NewGuid(),ProductId=p.Id,TransactionType=type,QuantityChanged=q,SourceBinCode=source,DestinationBinCode="N/A",ReasonCode="F1 data fixture",CreatedBy="F1"};
            db.InventoryTransactions.Add(t);await db.SaveChangesAsync();
            var date=DateTime.UtcNow.Date.AddDays(days).AddHours(1);
            await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE InventoryTransactions SET CreatedAt={date} WHERE Id={t.Id}");
        }
        await History(product,"OUTBOUND",-2,-2,bin.Code);await History(product,"WAVE_OUTBOUND",-3,-2,bin.Code);await History(product,"OUTBOUND_SERIAL",-4,-2,bin.Code);
        await History(product,"TRANSFER",-99,-2,bin.Code);await History(product,"OUTBOUND",1,-2,bin.Code);await History(product,"OUTBOUND",-100,-91,bin.Code);await History(product,"OUTBOUND",-100,1,bin.Code);
        await History(other,"OUTBOUND",-77,-2,otherBin.Code);
        // Same scoped product exported from an outside zone must not inflate scoped slotting.
        await History(product,"OUTBOUND",-8,-2,otherBin.Code);
        var ai=new Probe();var forecast=new GetStockForecastQueryHandler(db,ai);var slotting=new GetSlottingRecommendationsQueryHandler(db,ai);
        var before=await FixtureDatabase.Snapshot(fixture.Connection);
        ai.Forecast=JsonSerializer.Serialize(new{SKU=product.SKU,HistoricalMovements=Array.Empty<object>(),ForecastedDemand=new[]{new{Date=DateTime.UtcNow.Date.AddDays(1),Quantity=1}}});
        var result=await forecast.Handle(new(new StockForecastRequest{Sku=product.SKU}),default);
        check(result.IsSuccess&&result.Data!.HistoricalMovements.Sum(x=>x.Quantity)==17,"forecast SQL aggregation includes OUTBOUND/WAVE/SERIAL, excludes transfer/positive/old/future");
        using(var doc=JsonDocument.Parse(ai.LastForecast))
        {
            check(doc.RootElement.GetProperty("History").GetArrayLength()==1&&doc.RootElement.GetProperty("History")[0].GetProperty("TotalPickedQty").GetInt64()==17,"provider receives authoritative grouped daily demand17");
            check(doc.RootElement.GetProperty("ForecastStartDate").GetString()==DateTime.UtcNow.Date.AddDays(1).ToString("yyyy-MM-dd"),"forecast payload explicit future horizon");
        }
        check(!(await forecast.Handle(new(new StockForecastRequest{Sku=empty.SKU}),default)).IsSuccess,"forecast empty history is expected rejection");
        check(!(await forecast.Handle(new(new StockForecastRequest{Sku="missing"}),default)).IsSuccess,"forecast unknown SKU is expected rejection");
        foreach(var response in new[]{"null","{}","[]","not-json",JsonSerializer.Serialize(new{SKU="wrong",ForecastedDemand=new[]{new{Date=DateTime.UtcNow.AddDays(1),Quantity=1}}}),JsonSerializer.Serialize(new{SKU=product.SKU,ForecastedDemand=new[]{new{Date=DateTime.UtcNow.AddDays(-1),Quantity=1}}}),JsonSerializer.Serialize(new{SKU=product.SKU,ForecastedDemand=new[]{new{Date=DateTime.UtcNow.AddDays(1),Quantity=-1}}})})
        {ai.Forecast=response;check(!(await forecast.Handle(new(new StockForecastRequest{Sku=product.SKU}),default)).IsSuccess,"invalid forecast shape/identity/date/quantity rejected");}
        ai.Slotting="[]";
        check((await slotting.Handle(new(new SlottingRecommendationRequest{ZoneId=zone.Id}),default)).IsSuccess,"empty advisory slotting list has no executable effect");
        using(var doc=JsonDocument.Parse(ai.LastSlotting))
        {var products=doc.RootElement.GetProperty("Products");check(products.GetArrayLength()==1&&products[0].GetProperty("SKU").GetString()==product.SKU&&products[0].GetProperty("TotalPickedQty").GetInt64()==9,"slotting zone constrains product population AND historical source bins");}
        foreach(var response in new[]{"null","{}","not-json",JsonSerializer.Serialize(new[]{new{SKU=other.SKU,CurrentZone=zone.Name,SuggestedZone=zone.Name,VelocityClass="Fast",AIReasoning="Fixture"}}),JsonSerializer.Serialize(new[]{new{SKU=product.SKU,CurrentZone=zone.Name,SuggestedZone="Invented zone",VelocityClass="Fast",AIReasoning="Fixture"}})})
        {ai.Slotting=response;check(!(await slotting.Handle(new(new SlottingRecommendationRequest{ZoneId=zone.Id}),default)).IsSuccess,"invalid/outside SKU/invented-zone slotting recommendation rejected");}
        check(before==await FixtureDatabase.Snapshot(fixture.Connection),"all SQL-backed AI query acceptance cases preserve complete database");
    }
    sealed class Probe:IAiInsightService
    {
        public string Forecast="{}",Slotting="[]",LastForecast="",LastSlotting="";
        public Task<string> PredictDemandAsync(string value){LastForecast=value;return Task.FromResult(Forecast);}
        public Task<string> AnalyzeSlottingOptimizationAsync(string value){LastSlotting=value;return Task.FromResult(Slotting);}
        public Task<string> GenerateInsightAsync(string value)=>throw new NotSupportedException();
        public Task<string> GenerateExecutiveInsightAsync(string value)=>throw new NotSupportedException();
        public Task<string> AnalyzeReceiptImageAsync(byte[] value,string mime)=>throw new NotSupportedException();
        public Task<string> AnalyzeDamageImageAsync(byte[] value,string mime)=>throw new NotSupportedException();
        public Task<string> ParseVoiceCommandAsync(string value)=>throw new NotSupportedException();
    }
}
