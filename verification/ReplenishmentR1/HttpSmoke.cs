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
        await using var fixture = new FixtureDatabase("R1 HTTP actual route/auth/DI/SQL; no shared DB/jobs/seed");
        ApplicationDbContext Db() => new(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(fixture.Connection).Options, new FixtureUser());
        var password = Convert.ToHexString(RandomNumberGenerator.GetBytes(16)); Guid sourceId, targetId, sourceStock, targetStock, productId;
        await using (var db = Db())
        {
            await db.Database.MigrateAsync();
            var wh = new Warehouse { Code = "HTTP-W", Name = "HTTP-W" }; var zone = new Zone { Code = "HTTP-Z", Name = "HTTP-Z", Warehouse = wh };
            var source = new Bin { Id = Guid.NewGuid(), Code = "HTTP-S", Zone = zone, MaxCapacity = 100, CurrentOccupancy = 100 };
            var target = new Bin { Id = Guid.NewGuid(), Code = "HTTP-T", Zone = zone, MaxCapacity = 10, CurrentOccupancy = 1 };
            var product = new Product { SKU = "HTTP-P", Barcode = "HTTP-P", Name = "Product", TrackingMode = ProductTrackingMode.Lot };
            var expiry = DateTime.UtcNow.Date.AddDays(100);
            var s = new BinInventory { Bin = source, Product = product, LotNumber = "HTTP-LOT", ExpirationDate = expiry, Quantity = 100, ReservedQuantity = 20, Status = InventoryStatus.Available };
            var t = new BinInventory { Bin = target, Product = product, LotNumber = "HTTP-LOT", ExpirationDate = expiry, Quantity = 1, Status = InventoryStatus.Available };
            db.BinInventories.AddRange(s, t);
            db.Users.Add(new User { Username = "r1-http", Email = "r1@example.invalid", Role = "Admin", IsActive = true, PasswordHash = new PasswordHasher().HashPassword(password) });
            db.Users.Add(new User { Username = "r1-staff", Email = "r1-staff@example.invalid", Role = "Staff", IsActive = true, PasswordHash = new PasswordHasher().HashPassword(password) });
            await db.SaveChangesAsync(); sourceId = source.Id; targetId = target.Id; sourceStock = s.Id; targetStock = t.Id; productId = product.Id;
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
        const string route = "/api/v1/Inventory/run-auto-replenish";
        async Task Login(string user)
        {
            using var response = await http.PostAsJsonAsync("/api/v1/Auth/login", new { username = user, password }); check(response.StatusCode == HttpStatusCode.OK, "HTTP actual login200 " + user);
            var token = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data").GetProperty("token").GetString();
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }
        async Task Post(int expected, string label)
        {
            using var response = await http.PostAsJsonAsync(route, new { });
            check(response.StatusCode == HttpStatusCode.OK, label + " HTTP200");
            var data = await response.Content.ReadFromJsonAsync<JsonElement>();
            check(data.GetProperty("isSuccess").GetBoolean() && data.GetProperty("data").GetInt32() == expected, label + " movement count=" + expected);
        }
        try
        {
            bool ready = false;
            for (int i = 0; i < 100 && !process.HasExited; i++)
            {
                try { using var response = await http.GetAsync("/openapi/v1.json"); if (response.IsSuccessStatusCode) { ready = true; break; } }
                catch (HttpRequestException) { }
                await Task.Delay(200);
            }
            check(ready, "R1 actual API boots with existing 31 migrations, seed/jobs off");
            using (var response = await http.PostAsJsonAsync(route, new { })) check(response.StatusCode == HttpStatusCode.Unauthorized, "HTTP anonymous refill401");
            await Login("r1-http"); await Post(1, "happy refill");
            await using (var db = Db())
            {
                var source = await db.BinInventories.FindAsync(sourceStock); var target = await db.BinInventories.FindAsync(targetStock);
                check(source!.Quantity == 91 && source.ReservedQuantity == 20 && target!.Quantity == 10, "HTTP committed physical/ATP invariant");
                check((await db.Bins.FindAsync(sourceId))!.CurrentOccupancy == 91 && (await db.Bins.FindAsync(targetId))!.CurrentOccupancy == 10, "HTTP source/target occupancy conserved");
                check(source.LotNumber == target!.LotNumber && source.ExpirationDate == target.ExpirationDate && await db.InventoryTransactions.CountAsync(x => x.TransactionType == "TRANSFER") == 1 && await db.AuditLogs.AnyAsync(), "HTTP lot/expiry/ledger/audit persisted");
            }
            var after = await FixtureDatabase.Snapshot(fixture.Connection); await Post(0, "repeat re-evaluates full target");
            check(after == await FixtureDatabase.Snapshot(fixture.Connection), "HTTP repeat has no duplicate ledger/audit/output");
            foreach (var kind in new[] { "reserved-ATP", "source-LPN", "target-LPN", "serial-mode" })
            {
                await using (var db = Db())
                {
                    var s = await db.BinInventories.FindAsync(sourceStock); var t = await db.BinInventories.FindAsync(targetStock);
                    s!.Quantity = 100; s.ReservedQuantity = kind == "reserved-ATP" ? 95 : 0; s.LpnCode = kind == "source-LPN" ? "PALLET" : null;
                    t!.Quantity = 1; t.LpnCode = kind == "target-LPN" ? "PALLET" : null;
                    (await db.Bins.FindAsync(sourceId))!.CurrentOccupancy = 100; (await db.Bins.FindAsync(targetId))!.CurrentOccupancy = 1;
                    (await db.Products.FindAsync(productId))!.TrackingMode = kind == "serial-mode" ? ProductTrackingMode.Serial : ProductTrackingMode.Lot;
                    await db.SaveChangesAsync();
                }
                var before = await FixtureDatabase.Snapshot(fixture.Connection); await Post(0, kind + " fail-closed skip");
                check(before == await FixtureDatabase.Snapshot(fixture.Connection), "HTTP " + kind + " skip preserves all stock/metadata/ledger/audit");
            }
            await Login("r1-staff"); await Post(0, "existing Authorize contract permits authenticated Staff (unchanged role policy)");
        }
        finally
        {
            if (!process.HasExited) process.Kill(entireProcessTree: true);
            await process.WaitForExitAsync(); await File.WriteAllTextAsync(Path.Combine(report, "http-host.log"), await stdout + await stderr);
        }
    }
}
