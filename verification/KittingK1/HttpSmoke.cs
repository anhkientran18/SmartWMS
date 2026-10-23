using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums;
using SmartWMS.Infrastructure.Persistence.DbContext;
using SmartWMS.Infrastructure.Services;

static class HttpSmoke
{
    public static async Task Run(string report, string apiDll, Action<bool, string> check)
    {
        await using var fixture = new FixtureDatabase("K1 HTTP: actual controller, binding, validator, DI, auth, handler and SQL fixture");
        ApplicationDbContext Db() => new(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(fixture.Connection).Options, new FixtureUser());
        var password = Convert.ToHexString(RandomNumberGenerator.GetBytes(16));
        Guid sourceId, targetId, productId, kitId, lpnProductId;
        await using (var db = Db())
        {
            await db.Database.MigrateAsync();
            var wh = new Warehouse { Code = "HTTP-W", Name = "HTTP-W" }; var zone = new Zone { Code = "HTTP-Z", Name = "HTTP-Z", Warehouse = wh };
            var source = new Bin { Id = Guid.NewGuid(), Code = "HTTP-S", Zone = zone, MaxCapacity = 100, CurrentOccupancy = 20 };
            var target = new Bin { Id = Guid.NewGuid(), Code = "HTTP-T", Zone = zone, MaxCapacity = 2 };
            var component = new Product { SKU = "HTTP-C", Barcode = "HTTP-C", Name = "Component" };
            var lpn = new Product { SKU = "HTTP-LPN", Barcode = "HTTP-LPN", Name = "LPN component" };
            var kit = new Product { SKU = "HTTP-K", Barcode = "HTTP-K", Name = "Kit" };
            db.Bins.Add(target); db.Products.Add(kit);
            db.BinInventories.AddRange(new BinInventory { Bin = source, Product = component, LotNumber = "LOT-A", Quantity = 10, ReservedQuantity = 3, Status = InventoryStatus.Available },
                new BinInventory { Bin = source, Product = lpn, LotNumber = "LOT-LPN", Quantity = 10, LpnCode = "PALLET", Status = InventoryStatus.Available });
            db.Users.Add(new User { Username = "k1-http", Email = "k1@example.invalid", Role = "Admin", IsActive = true, PasswordHash = new PasswordHasher().HashPassword(password) });
            await db.SaveChangesAsync(); sourceId = source.Id; targetId = target.Id; productId = component.Id; kitId = kit.Id; lpnProductId = lpn.Id;
        }
        var listener = new TcpListener(IPAddress.Loopback, 0); listener.Start(); var port = ((IPEndPoint)listener.LocalEndpoint).Port; listener.Stop();
        apiDll = Path.GetFullPath(apiDll);
        var start = new ProcessStartInfo("dotnet") { WorkingDirectory = report, CreateNoWindow = true, UseShellExecute = false, RedirectStandardOutput = true, RedirectStandardError = true };
        start.ArgumentList.Add(apiDll); start.ArgumentList.Add("--contentRoot"); start.ArgumentList.Add(Path.GetDirectoryName(apiDll)!);
        start.Environment["ASPNETCORE_ENVIRONMENT"] = "Development"; start.Environment["ASPNETCORE_URLS"] = $"http://127.0.0.1:{port}";
        start.Environment["ConnectionStrings__DefaultConnection"] = fixture.Connection; start.Environment["ConnectionStrings__HangfireConnection"] = fixture.Connection;
        start.Environment["JwtSettings__Secret"] = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        foreach (var key in new[] { "DatabaseInitialization__ApplyMigrationsOnStartup", "DatabaseInitialization__SeedOnStartup", "Hangfire__EnableServer", "Hangfire__RegisterRecurringJobsOnStartup", "Hangfire__PrepareSchemaIfNecessary" }) start.Environment[key] = "false";
        using var process = Process.Start(start)!; var stdout = process.StandardOutput.ReadToEndAsync(); var stderr = process.StandardError.ReadToEndAsync();
        using var http = new HttpClient { BaseAddress = new Uri($"http://127.0.0.1:{port}"), Timeout = TimeSpan.FromSeconds(20) };
        try
        {
            bool ready = false;
            for (int i = 0; i < 100 && !process.HasExited; i++)
            {
                try { using var r = await http.GetAsync("/openapi/v1.json"); if (r.IsSuccessStatusCode) { ready = true; break; } }
                catch (HttpRequestException) { }
                await Task.Delay(200);
            }
            check(ready, "HTTP actual API boots on isolated migrated fixture, seed/jobs disabled");
            object Payload(Guid component, int quantity = 2) => new { kitProductId = kitId, targetBinId = targetId, assembleQuantity = quantity,
                components = new[] { new { componentProductId = component, sourceBinId = sourceId, quantityPerKit = 2 } } };
            const string route = "/api/v1/Kitting/assemble";
            using (var response = await http.PostAsJsonAsync(route, Payload(productId))) check(response.StatusCode == HttpStatusCode.Unauthorized, "HTTP anonymous assembly401");
            using var login = await http.PostAsJsonAsync("/api/v1/Auth/login", new { username = "k1-http", password });
            check(login.StatusCode == HttpStatusCode.OK, "HTTP Admin login200");
            var token = (await login.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data").GetProperty("token").GetString();
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
            using (var response = await http.PostAsJsonAsync(route, Payload(productId)))
            {
                check(response.StatusCode == HttpStatusCode.OK, "HTTP happy assembly200: controller/DTO/DI usable");
                var json = await response.Content.ReadFromJsonAsync<JsonElement>(); check(json.GetProperty("isSuccess").GetBoolean(), "HTTP assembly business result success");
            }
            await using (var db = Db())
            {
                var stock = await db.BinInventories.SingleAsync(x => x.ProductId == productId);
                check(stock.Quantity == 6 && stock.ReservedQuantity == 3 && (await db.BinInventories.SingleAsync(x => x.ProductId == kitId)).Quantity == 2, "HTTP persisted ATP consumption/output/reserved invariant");
                check((await db.Bins.FindAsync(sourceId))!.CurrentOccupancy == 16 && (await db.Bins.FindAsync(targetId))!.CurrentOccupancy == 2, "HTTP source/destination occupancy consistent");
                check(await db.InventoryTransactions.CountAsync() == 2 && await db.AuditLogs.AnyAsync(), "HTTP ledger and audit committed");
            }
            var before = await FixtureDatabase.Snapshot(fixture.Connection);
            using (var response = await http.PostAsJsonAsync(route, Payload(lpnProductId))) check(response.StatusCode == HttpStatusCode.BadRequest &&
                (await response.Content.ReadAsStringAsync()).Contains("UNSUPPORTED_LPN_SERIAL"), "HTTP LPN rejected400 with explicit business message");
            check(before == await FixtureDatabase.Snapshot(fixture.Connection), "HTTP LPN rejection no stock/ledger/audit mutation");
            using (var response = await http.PostAsJsonAsync(route, Payload(productId, 1))) check(response.StatusCode == HttpStatusCode.BadRequest, "HTTP projected capacity overflow rejected400");
            check(before == await FixtureDatabase.Snapshot(fixture.Connection), "HTTP overflow rejection leaves database unchanged");
            using (var response = await http.PostAsJsonAsync(route, Payload(productId, 0))) check(response.StatusCode == HttpStatusCode.BadRequest, "HTTP invalid quantity validator400");
            using (var response = await http.PostAsJsonAsync(route, new { kitProductId = kitId, targetBinId = targetId, assembleQuantity = 1, components = new object?[] { null } }))
                check(response.StatusCode == HttpStatusCode.BadRequest, "HTTP null component rejected400, no validator500");
            check(before == await FixtureDatabase.Snapshot(fixture.Connection), "HTTP all rejections preserve complete fixture snapshot");
        }
        finally
        {
            if (!process.HasExited) process.Kill(entireProcessTree: true);
            await process.WaitForExitAsync(); await File.WriteAllTextAsync(Path.Combine(report, "http-host.log"), await stdout + await stderr);
        }
    }
}
