using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SmartWMS.Domain.Enums;
using SmartWMS.Infrastructure.Persistence.DbContext;

static class AuthorizationChecks
{
    public static async Task Run(TestHost host,string connection,string password,string sku,Guid zone,string report,Action<bool,string> check)
    {
        ApplicationDbContext Db()=>new(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(connection).Options,new FixtureUser());
        Guid bin,product;string lot;
        await using(var db=Db()){var stock=await db.BinInventories.Include(x=>x.Bin).Include(x=>x.Product).SingleAsync(x=>x.Bin!.Code.EndsWith("_SOURCE")&&x.Product!.SKU==sku);bin=stock.BinId;product=stock.ProductId;lot=stock.LotNumber;}
        var matrix=new List<object>();var valid=await host.Login("Admin",password);var parsed=new JwtSecurityTokenHandler().ReadJwtToken(valid);
        var expired=new JwtSecurityToken(parsed.Issuer,parsed.Audiences.First(),notBefore:DateTime.UtcNow.AddHours(-3),expires:DateTime.UtcNow.AddHours(-2),signingCredentials:new(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(host.Secret)),SecurityAlgorithms.HmacSha256));
        var invalids=new Dictionary<string,string?>{{"Anonymous",null},{"Malformed","malformed"},{"Expired",new JwtSecurityTokenHandler().WriteToken(expired)}};
        var cases=new[]{("POST","Inventory/adjust-stock"),("POST","Inventory/change-status"),("POST","Inventory/run-auto-replenish"),("POST","CycleCounting/create-sheet"),("POST","CycleCounting/confirm"),("GET","CycleCounting/"+Guid.Empty),("POST","Chat/ask"),("GET","Dashboard/executive"),("GET","Dashboard/ai-slotting-recommendations?zoneId="+zone),("GET","Forecasts/demand-prediction?sku="+sku),("GET","Bins/"+bin+"/contents"),("GET","/hangfire")};
        foreach(var auth in invalids)
        {
            host.Http.DefaultRequestHeaders.Authorization=auth.Value==null?null:new("Bearer",auth.Value);
            foreach(var (method,path) in cases)
            {
                using var request=new HttpRequestMessage(new HttpMethod(method),path=="/hangfire"?path:"/api/v1/"+path);if(method=="POST")request.Content=JsonContent.Create(new{});
                using var response=await host.Http.SendAsync(request);int expected=path=="/hangfire"?200:401;
                check((int)response.StatusCode==expected,$"auth {auth.Key} {method} {path} expected{expected}");matrix.Add(new{endpoint=method+" "+path,role=auth.Key,status=(int)response.StatusCode});
            }
        }
        foreach(var role in new[]{"Admin","WarehouseManager","Staff"})
        {
            await host.Login(role,password);
            async Task<JsonElement> Send(string method,string path,object? body,int expected=200)
            {
                using var req=new HttpRequestMessage(new HttpMethod(method),path=="/hangfire"?path:"/api/v1/"+path);if(body!=null)req.Content=JsonContent.Create(body);
                using var res=await host.Http.SendAsync(req);check((int)res.StatusCode==expected,$"auth {role} {method} {path} expected{expected}");matrix.Add(new{endpoint=method+" "+path,role,status=(int)res.StatusCode});
                if(path=="/hangfire"||expected!=200)return default;
                var j=await res.Content.ReadFromJsonAsync<JsonElement>();check(j.GetProperty("isSuccess").GetBoolean(),"authorized result success "+role+" "+path);return j.GetProperty("data");
            }
            int beforeQuantity;long ledgerBefore,auditBefore;
            await using(var db=Db()){beforeQuantity=(await db.BinInventories.SingleAsync(x=>x.BinId==bin&&x.ProductId==product)).Quantity;ledgerBefore=await db.InventoryTransactions.LongCountAsync();auditBefore=await db.AuditLogs.LongCountAsync();}
            foreach(var amount in new[]{1,-1})
            {
                await Send("POST","Inventory/adjust-stock",new{binId=bin,productId=product,lotNumber=lot,adjustmentQuantity=amount,reasonCode="F1_AUTH_"+role});
                await using var db=Db();var stock=await db.BinInventories.SingleAsync(x=>x.BinId==bin&&x.ProductId==product);var location=await db.Bins.FindAsync(bin);
                check(stock.Quantity==beforeQuantity+(amount==1?1:0)&&stock.ReservedQuantity==0&&location!.CurrentOccupancy==stock.Quantity,"authorized adjustment physical/reserved/occupancy "+role);
            }
            foreach(var status in new[]{InventoryStatus.QCHold,InventoryStatus.Available})
            {await Send("POST","Inventory/change-status",new{binId=bin,productId=product,lotNumber=lot,newStatus=(int)status,reasonCode="F1_AUTH_"+role});await using var db=Db();check((await db.BinInventories.SingleAsync(x=>x.BinId==bin&&x.ProductId==product)).Status==status,"authorized persisted status "+role+" "+status);}
            var sheet=await Send("POST","CycleCounting/create-sheet",new{requestData=new{binId=bin,notes="F1_AUTH_"+role}});var sheetId=sheet.GetGuid();
            var details=await Send("GET","CycleCounting/"+sheetId,null);var counted=details.GetProperty("items").EnumerateArray().Select(x=>new{itemId=x.GetProperty("id").GetGuid(),countedQuantity=x.GetProperty("systemQuantity").GetInt32()}).ToArray();
            await Send("POST","CycleCounting/confirm",new{countSheetId=sheetId,countedItems=counted,notes="F1 zero variance"});
            var unchanged=await FixtureDatabase.Snapshot(connection);await Send("POST","CycleCounting/confirm",new{countSheetId=sheetId,countedItems=counted},409);check(unchanged==await FixtureDatabase.Snapshot(connection),"cycle double-submit rejects without partial state "+role);
            unchanged=await FixtureDatabase.Snapshot(connection);
            var refill=await Send("POST","Inventory/run-auto-replenish",new{});check(refill.GetInt32()==0,"authorized R1 full target skip0 "+role);
            check(unchanged==await FixtureDatabase.Snapshot(connection),"authorized R1 repeat exact SQL snapshot unchanged "+role);
            await using(var db=Db())check(await db.InventoryTransactions.LongCountAsync()==ledgerBefore+4&&
                await db.InventoryTransactions.CountAsync(x=>x.ReasonCode.Contains("F1_AUTH_"+role)&&x.TransactionType=="ADJUSTMENT")==2&&
                await db.InventoryTransactions.CountAsync(x=>x.ReasonCode.Contains("F1_AUTH_"+role)&&x.TransactionType=="STATUS_CHANGE"&&x.QuantityChanged==0)==2&&
                await db.AuditLogs.LongCountAsync()>auditBefore&&(await db.CycleCountSheets.FindAsync(sheetId))!.Status=="Completed",
                "authorized ledger/audit/cycle status "+role);
            foreach(var (method,path) in cases.Where(x=>x.Item2.StartsWith("Chat/")||x.Item2.StartsWith("Dashboard/")||x.Item2.StartsWith("Forecasts/")||x.Item2.StartsWith("Bins/")||x.Item2=="/hangfire"))
            {
                var body=method=="POST"?new{message="F1 authorization boundary"}:null;
                await Send(method,path,body,role=="Staff"&&(path.StartsWith("Forecasts/")||path.StartsWith("Bins/"))?403:200);
            }
        }
        await File.WriteAllTextAsync(Path.Combine(report,"authorization-matrix.json"),JsonSerializer.Serialize(matrix,new JsonSerializerOptions{WriteIndented=true}));
    }
}
