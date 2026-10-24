using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Domain.Entities;
using SmartWMS.Infrastructure.Persistence.DbContext;

static class StaffExecution
{
    public static async Task Run(TestHost host,string connection,Guid bin,Guid zone,Guid product,string admin,string staff,string repo,Action<bool,string> check)
    {
        ApplicationDbContext Db()=>new(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(connection).Options,new FixtureUser());
        Guid supplier=Guid.NewGuid(),destination=Guid.NewGuid();
        await using(var db=Db())
        {
            db.Suppliers.Add(new Supplier{Id=supplier,Code="S1_SUP",Name="S1 fixture supplier"});
            db.Bins.Add(new Bin{Id=destination,Code="S1_DEST",ZoneId=zone,MaxCapacity=1000});await db.SaveChangesAsync();
        }
        void Token(string value)=>host.Http.DefaultRequestHeaders.Authorization=new AuthenticationHeaderValue("Bearer",value);
        async Task<JsonElement> Call(string method,string path,object? body=null)
        {
            using var req=new HttpRequestMessage(new HttpMethod(method),"/api/v1/"+path);if(body!=null)req.Content=JsonContent.Create(body);
            using var response=await host.Http.SendAsync(req);var text=await response.Content.ReadAsStringAsync();
            check(response.StatusCode==HttpStatusCode.OK,"Staff workflow "+method+" "+path+" HTTP200");
            using var json=JsonDocument.Parse(text);check(json.RootElement.GetProperty("isSuccess").GetBoolean(),"Staff workflow business success "+path);
            return json.RootElement.GetProperty("data").Clone();
        }
        Token(admin);
        var receipt=(await Call("POST","InboundReceipts",new{receiptNumber="S1_RECEIVE",binId=bin,supplierId=supplier,expectedDeliveryDate=DateTime.UtcNow.Date.AddDays(1),items=new[]{new{productId=product,expectedQuantity=4,lotNumber="LOT-DEFAULT"}}})).GetGuid();
        Token(staff);
        var detail=await Call("GET","InboundReceipts/"+receipt);
        await Call("POST","InboundReceipts/confirm-receipt",new{inboundReceiptId=receipt,receivedItems=new[]{new{itemId=detail.GetProperty("items")[0].GetProperty("id").GetGuid(),quantityReceived=4,expectedReceivedQuantity=0}}});
        detail=await Call("GET","InboundReceipts/"+receipt);check(detail.GetProperty("status").GetString()=="Completed","Staff receive Completed");
        await Call("POST","InventoryTransfers",new{productId=product,sourceBinId=bin,destinationBinId=destination,transferQuantity=1,lotNumber="LOT-DEFAULT",reason="S1 staff put-away"});
        Token(admin);
        var order=(await Call("POST","OutboundOrders",new{orderNumber="S1_OUT",binId=bin,expectedShipDate=DateTime.UtcNow.Date.AddDays(1),items=new[]{new{productId=product,requestedQuantity=2}}})).GetGuid();
        await Call("POST","OutboundOrders/allocate-pick-task",new{outboundOrderId=order});
        Token(staff);
        detail=await Call("GET","OutboundOrders/"+order);
        var items=detail.GetProperty("items").EnumerateArray().SelectMany(x=>x.GetProperty("reservations").EnumerateArray()).Select(x=>new{reservationId=x.GetProperty("id").GetGuid(),quantity=x.GetProperty("quantity").GetInt32()}).ToArray();
        await Call("POST",$"OutboundOrders/{order}/pick",new{items});
        int physicalAfterPick;await using(var db=Db())physicalAfterPick=await db.BinInventories.SumAsync(x=>x.Quantity);
        await Call("POST",$"OutboundOrders/{order}/pack",new{});
        await Call("POST",$"OutboundOrders/{order}/ship",new{});
        detail=await Call("GET","OutboundOrders/"+order);check(detail.GetProperty("status").GetString()=="Shipped","Staff B3 pick/pack/ship completes (existing dispatch policy)");
        await using(var db=Db())
        {
            check(physicalAfterPick==25&&await db.BinInventories.SumAsync(x=>x.Quantity)==25,"Staff pack/ship do not deduct twice; total physical25");
            check((await db.BinInventories.SingleAsync(x=>x.BinId==bin)).Quantity==24&&(await db.BinInventories.SingleAsync(x=>x.BinId==destination)).Quantity==1,"Staff receive/move/pick final stock source24 destination1");
            check((await db.Bins.FindAsync(bin))!.CurrentOccupancy==24&&(await db.Bins.FindAsync(destination))!.CurrentOccupancy==1&&await db.BinInventories.SumAsync(x=>x.ReservedQuantity)==0,"Staff occupancy/reservation consistent");
            check(await db.InventoryTransactions.Where(x=>x.TransactionType=="INBOUND").SumAsync(x=>x.QuantityChanged)==4&&await db.InventoryTransactions.Where(x=>x.TransactionType=="OUTBOUND"&&x.ReasonCode!="S1_HISTORY").SumAsync(x=>x.QuantityChanged)==-2,"Staff receive+pick physical ledger +4/-2 (excluding seeded demand history)");
        }
        await Call("POST","Products/parse-barcode",new{rawBarcodeData="BARCODE:S1_BAR"});
        using var upload=new MultipartFormDataContent();var bytes=new ByteArrayContent(await File.ReadAllBytesAsync(Path.Combine(repo,"verification/AcceptanceF1/fixtures/damage.png")));bytes.Headers.ContentType=new MediaTypeHeaderValue("image/png");upload.Add(bytes,"file","damage.png");
        var before=await FixtureDatabase.Snapshot(connection);
        using var damage=await host.Http.PostAsync("/api/v1/InboundReceipts/report-damage",upload);
        check(damage.StatusCode==HttpStatusCode.OK,"Staff damage advice via loopback provider remains200");
        check(before==await FixtureDatabase.Snapshot(connection),"damage advice never changes stock/ledger/audit");
    }
}
