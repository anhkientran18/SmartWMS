using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Features.InventoryManagement.Queries.GetInventorySummary;
using SmartWMS.Application.Features.InventoryManagement.Queries.GetLowStockAlerts;
using SmartWMS.Application.Features.Dashboard.Queries.GetWarehouseDashboard;
using SmartWMS.Application.Features.Dashboard.DTOs.Queries;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums;
using SmartWMS.Infrastructure.Persistence.DbContext;
using SmartWMS.Infrastructure.Services;

if (args.Length is not (2 or 3) || args[0] is not ("--summary" or "--migrations"))
    throw new ArgumentException("Usage: <--summary|--migrations> <report-dir> [api-dll]");
var report = Path.GetFullPath(args[1]); Directory.CreateDirectory(report);
var results = new List<string>();
void Check(bool ok, string label)
{
    var line = (ok ? "PASS: " : "FAIL: ") + label; results.Add(line); Console.WriteLine(line);
    if (!ok) throw new Exception(line);
}
try
{
    if (args[0] == "--migrations") await VerifyMigrations();
    else await VerifySummary();
    Console.WriteLine($"ALL {results.Count(x => x.StartsWith("PASS:"))} B2 CHECKS PASSED");
}
finally { await File.WriteAllLinesAsync(Path.Combine(report, "results.txt"), results); }

ApplicationDbContext Db(string connection) => new(new DbContextOptionsBuilder<ApplicationDbContext>()
    .UseSqlServer(connection).Options, new FixtureUser());

async Task VerifySummary()
{
    await using var fixture = new FixtureDatabase("Summary");
    Console.WriteLine("Fixture database: " + fixture.Name);
    await using var db = Db(fixture.Connection);
    if (args.Length == 3) await db.Database.MigrateAsync();
    else await db.Database.EnsureCreatedAsync();
    var empty = await new GetInventorySummaryQueryHandler(db).Handle(new(), default);
    Check(empty.IsSuccess && empty.Data!.TotalQuantity == 0 && empty.Data.TotalProducts == 0 && empty.Data.LowStockItems == 0, "empty stock summary is zero");
    var warehouse = new Warehouse { Code = "B2-W", Name = "fixture" };
    var zone = new Zone { Code = "B2-Z", Name = "fixture", Warehouse = warehouse };
    var bin = new Bin { Id = Guid.NewGuid(), Code = "B2-B", Zone = zone, MaxCapacity = 20_000_000_000d };
    var a = new Product { SKU = "B2-A", Barcode = "B2-A", Name = "A" };
    var b = new Product { SKU = "B2-B", Barcode = "B2-B", Name = "B" };
    db.Products.AddRange(a, b); db.Bins.Add(bin);
    BinInventory Stock(Product product, int quantity, string lot, InventoryStatus status = InventoryStatus.Available, int reserved = 0) =>
        new() { Bin = bin, Product = product, LotNumber = lot, Quantity = quantity, ReservedQuantity = reserved, Status = status };
    db.BinInventories.Add(Stock(a, int.MaxValue, "MAX")); bin.CurrentOccupancy = int.MaxValue;
    await db.SaveChangesAsync();
    var boundary = await new GetInventorySummaryQueryHandler(db).Handle(new(), default);
    Check(boundary.Data!.TotalQuantity == int.MaxValue, "single Int32.MaxValue row boundary");
    db.BinInventories.Add(Stock(b, 1, "B")); bin.CurrentOccupancy++;
    await db.SaveChangesAsync();
    Check((await new GetInventorySummaryQueryHandler(db).Handle(new(), default)).Data!.TotalQuantity == (long)int.MaxValue + 1,
        "cross-product sum widens before CLR aggregation");
    db.BinInventories.Add(Stock(a, int.MaxValue, "SECOND"));
    var low = new Product { SKU = "B2-LOW", Barcode = "B2-LOW", Name = "Low" };
    var threshold = new Product { SKU = "B2-20", Barcode = "B2-20", Name = "Twenty" };
    var deleted = new Product { SKU = "B2-DELETED", Barcode = "B2-DELETED", Name = "Deleted", IsDeleted = true };
    var noStock = new Product { SKU = "B2-NO-STOCK", Barcode = "B2-NO-STOCK", Name = "No stock row" };
    db.Products.AddRange(low, threshold, deleted, noStock);
    db.BinInventories.AddRange(Stock(low, 19, "LOW", InventoryStatus.Damaged), Stock(threshold, 20, "THRESHOLD"),
        Stock(deleted, int.MaxValue, "DELETED"), Stock(a, 7, "HOLD", InventoryStatus.QCHold), Stock(a, 5, "RESERVED", InventoryStatus.Available, 5));
    bin.CurrentOccupancy = 3d * int.MaxValue + 1 + 19 + 20 + 7 + 5;
    await db.SaveChangesAsync();
    var expected = 2L * int.MaxValue + 1 + 19 + 20 + 7 + 5;
    var summary = await new GetInventorySummaryQueryHandler(db).Handle(new(), default);
    Check(summary.IsSuccess && summary.Data!.TotalQuantity == expected, "SQL grouped sum and CLR total exceed Int32 without overflow");
    Check(summary.Data!.TotalProducts == 4 && summary.Data.LowStockItems == 2, "active products with rows counted; low stock remains physical <20");
    var alerts = await new GetLowStockAlertsQueryHandler(db).Handle(new(), default);
    Check(alerts.IsSuccess && alerts.Data!.Count == 2 && alerts.Data.Single(x => x.ProductId == low.Id).CurrentStock == 19,
        "low-stock SQL SUM(bigint) handles large product before threshold filter");
    Check(alerts.Data!.All(x => x.ProductId != a.Id && x.ProductId != deleted.Id && x.ProductId != threshold.Id), "low-stock excludes large/deleted/exact20 while preserving threshold");
    var dashboard = await new GetWarehouseDashboardQueryHandler(db).Handle(new(new WarehouseDashboardQueryRequest()), default);
    Check(dashboard.IsSuccess && dashboard.Data!.LowStockAlerts.Any(x => x.ProductId == low.Id) &&
        dashboard.Data.LowStockAlerts.All(x => x.ProductId != a.Id), "warehouse dashboard shared SUM overflow root cause fixed");
    Check((await db.BinInventories.Where(x => x.ProductId == a.Id).SumAsync(x => (long)x.Quantity)) == 2L * int.MaxValue + 12,
        "physical quantity includes held/reserved units; no mutation or available-stock substitution");
    if (args.Length == 3) await HttpSmoke(fixture.Connection, Path.GetFullPath(args[2]), expected);
}

async Task VerifyMigrations()
{
    await using var fixture = new FixtureDatabase("Migration");
    Console.WriteLine("Fixture database: " + fixture.Name);
    await using var db = Db(fixture.Connection);
    await db.Database.MigrateAsync();
    Check(!(await db.Database.GetPendingMigrationsAsync()).Any(), "fresh database migrates through every repository migration");
    Check((await db.Database.GetAppliedMigrationsAsync()).Count() == db.Database.GetMigrations().Count(), "all source migrations recorded by actual execution, not a synthetic history baseline");
    Check(!db.Database.HasPendingModelChanges(), "migration model snapshot matches current model");
    Check(await db.Products.CountAsync() == 0 && await db.BinInventories.CountAsync() == 0,
        "fresh migration does not fabricate demo products or stock to satisfy legacy guard");
    var before = await FixtureDatabase.Snapshot(fixture.Connection);
    await db.Database.MigrateAsync();
    Check(before == await FixtureDatabase.Snapshot(fixture.Connection), "already applied migration chain is a no-op on rerun");

    foreach (var kind in new[] { "approved", "unknown-product", "missing-stock", "serial-evidence", "other-product-stock", "negative-stock", "picking", "empty-receipt", "orphan-occupancy" })
    {
        await using var legacy = new FixtureDatabase("Legacy " + kind);
        await using var context = Db(legacy.Connection);
        await context.GetService<IMigrator>().MigrateAsync("20261019033151_EnforceActiveSupplierCodeUniqueness");
        var products = new[]
        {
            (Id: Guid.Parse("601f864f-5e9a-4021-8a4b-8c7aad9a1ef1"), Sku: "ASUS-ROGSTRIX-G16"),
            (Id: Guid.Parse("e511b03f-6825-4a60-9a24-55b8c9ca189e"), Sku: "COCA-COOL-320"),
            (Id: Guid.Parse("be01ea85-9d57-4aea-8272-517dfa1cff5d"), Sku: "LOGI-MOUSE-MX3"),
            (Id: Guid.Parse("bf2ed393-73c1-4bf9-9322-c6c39c49ff47"), Sku: "MILK-VINAMILK-1L")
        };
        var warehouseId = Guid.NewGuid();
        var zoneId = Guid.NewGuid();
        var binId = Guid.NewGuid();
        await context.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT Warehouses (Id,Code,Name,Address,IsDeleted,CreatedAt,CreatedBy)
            VALUES ({warehouseId},N'B2-WH',N'B2 warehouse',N'Fixture',0,SYSUTCDATETIME(),N'B2Fixture');
            INSERT Zones (Id,Code,Name,WarehouseId,IsDeleted,CreatedAt,CreatedBy)
            VALUES ({zoneId},N'B2-ZONE',N'B2 zone',{warehouseId},0,SYSUTCDATETIME(),N'B2Fixture');
            INSERT Bins (Id,Code,ZoneId,MaxCapacity,CurrentOccupancy,IsDeleted,CreatedAt,CreatedBy)
            VALUES ({binId},N'B2-BIN',{zoneId},100,0,0,SYSUTCDATETIME(),N'B2Fixture');
            """);
        var stockId = Guid.NewGuid();
        if (kind is not ("empty-receipt" or "orphan-occupancy"))
            foreach (var product in products.Take(kind == "unknown-product" ? 1 : 4))
                await context.Database.ExecuteSqlInterpolatedAsync($"""
                    INSERT Products (Id,SKU,Barcode,Name,CreatedAt,CreatedBy,IsDeleted,Weight,ABCClass)
                    VALUES ({product.Id},{product.Sku},{product.Sku},{product.Sku},SYSUTCDATETIME(),N'B2Fixture',0,0,N'C')
                    """);
        if (kind is not ("unknown-product" or "missing-stock" or "empty-receipt" or "orphan-occupancy"))
        {
            var productId = kind == "other-product-stock" ? products[0].Id : products[1].Id;
            await context.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT BinInventories (Id,BinId,ProductId,LotNumber,Quantity,Status,CreatedAt,CreatedBy)
                VALUES ({stockId},{binId},{productId},N'LEGACY-LOT',2,1,SYSUTCDATETIME(),N'B2Fixture');
                UPDATE Bins SET CurrentOccupancy=2 WHERE Id={binId};
                """);
        }
        if (kind == "serial-evidence")
            await context.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT ProductSerialNumbers (Id,ProductId,BinInventoryId,SerialCode,Status)
                VALUES ({Guid.NewGuid()},{products[1].Id},{stockId},N'B2-SERIAL',N'InStock')
                """);
        if (kind == "negative-stock")
            await context.Database.ExecuteSqlInterpolatedAsync($"UPDATE BinInventories SET Quantity=-1 WHERE Id={stockId}");
        if (kind == "picking")
            await context.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT OutboundIssues (Id,BinId,OrderNumber,Status,ExpectedShipDate,Priority,Notes,IsDeleted,CreatedAt,CreatedBy)
                VALUES ({Guid.NewGuid()},{binId},N'B2-LEGACY',N'Picking',SYSUTCDATETIME(),N'Normal',N'',0,SYSUTCDATETIME(),N'B2Fixture')
                """);
        if (kind == "empty-receipt")
            await context.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT InboundReceipts (Id,BinId,ReceiptNumber,Status,ExpectedDeliveryDate,ReferenceDocument,Notes,IsDeleted,CreatedAt,CreatedBy)
                VALUES ({Guid.NewGuid()},{binId},N'B2-LEGACY',N'New',SYSUTCDATETIME(),N'',N'',0,SYSUTCDATETIME(),N'B2Fixture')
                """);
        if (kind == "orphan-occupancy")
            await context.Database.ExecuteSqlInterpolatedAsync($"UPDATE Bins SET CurrentOccupancy=1 WHERE Id={binId}");
        var original = await FixtureDatabase.Snapshot(legacy.Connection);
        if (kind == "approved")
        {
            await context.Database.MigrateAsync();
            var mapped = await context.Products.AsNoTracking().ToListAsync();
            Check(mapped.Count == 4 && mapped.Single(x => x.Id == products[1].Id).TrackingMode == ProductTrackingMode.Lot &&
                mapped.Where(x => x.Id != products[1].Id).All(x => x.TrackingMode == ProductTrackingMode.None), "approved legacy four-product backfill unchanged");
            var retained = await context.BinInventories.SingleAsync(x => x.Id == stockId);
            Check(retained.Quantity == 2 && retained.ReservedQuantity == 0 && retained.LotNumber == "LEGACY-LOT", "approved legacy inventory identity/quantity/lot preserved");
            Check(!(await context.Database.GetPendingMigrationsAsync()).Any(), "approved legacy baseline reaches HEAD");
            var applied = await FixtureDatabase.Snapshot(legacy.Connection);
            await context.Database.MigrateAsync();
            Check(applied == await FixtureDatabase.Snapshot(legacy.Connection), "deployed/applied baseline unchanged by migration rerun");
        }
        else
        {
            int expectedCode = kind switch { "unknown-product" or "empty-receipt" or "orphan-occupancy" => 51000,
                "negative-stock" => 51002, "picking" => 51003, _ => 51001 };
            try { await context.Database.MigrateAsync(); throw new Exception("Expected legacy guard rejection: " + kind); }
            catch (Exception ex) when (FixtureDatabase.Sql(ex)?.Number == expectedCode)
            { Check(true, kind + " preserves fail-closed SQL" + expectedCode); }
            Check(original == await FixtureDatabase.Snapshot(legacy.Connection), kind + " rejection preserves all data/schema/history");
        }
    }
}

async Task HttpSmoke(string connection, string apiDll, long expected)
{
    var password = Convert.ToHexString(RandomNumberGenerator.GetBytes(16));
    await using (var db = Db(connection))
    {
        db.Users.Add(new User { Username = "b2-http", Email = "b2@example.invalid", Role = "Admin", IsActive = true,
            PasswordHash = new PasswordHasher().HashPassword(password) });
        await db.SaveChangesAsync();
    }
    var listener = new TcpListener(IPAddress.Loopback, 0); listener.Start();
    var port = ((IPEndPoint)listener.LocalEndpoint).Port; listener.Stop();
    var start = new ProcessStartInfo("dotnet") { WorkingDirectory = report, CreateNoWindow = true, UseShellExecute = false,
        RedirectStandardOutput = true, RedirectStandardError = true };
    start.ArgumentList.Add(apiDll); start.ArgumentList.Add("--contentRoot"); start.ArgumentList.Add(Path.GetDirectoryName(apiDll)!);
    start.Environment["ASPNETCORE_ENVIRONMENT"] = "Development";
    start.Environment["ASPNETCORE_URLS"] = $"http://127.0.0.1:{port}";
    start.Environment["ConnectionStrings__DefaultConnection"] = connection;
    start.Environment["ConnectionStrings__HangfireConnection"] = connection;
    start.Environment["JwtSettings__Secret"] = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
    foreach (var key in new[] { "DatabaseInitialization__ApplyMigrationsOnStartup", "DatabaseInitialization__SeedOnStartup",
        "Hangfire__EnableServer", "Hangfire__RegisterRecurringJobsOnStartup", "Hangfire__PrepareSchemaIfNecessary" }) start.Environment[key] = "false";
    using var process = Process.Start(start)!; var stdout = process.StandardOutput.ReadToEndAsync(); var stderr = process.StandardError.ReadToEndAsync();
    using var http = new HttpClient { BaseAddress = new Uri($"http://127.0.0.1:{port}"), Timeout = TimeSpan.FromSeconds(10) };
    try
    {
        bool ready = false;
        for (int i = 0; i < 100 && !process.HasExited; i++)
        {
            try { using var response = await http.GetAsync("/openapi/v1.json"); if (response.IsSuccessStatusCode) { ready = true; break; } }
            catch (HttpRequestException) { }
            await Task.Delay(200);
        }
        Check(ready, "HTTP API starts on real migrated fixture with seed/jobs off");
        using var login = await http.PostAsJsonAsync("/api/v1/Auth/login", new { username = "b2-http", password });
        Check(login.StatusCode == HttpStatusCode.OK, "HTTP login succeeds");
        var loginBody = await login.Content.ReadFromJsonAsync<JsonElement>();
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", loginBody.GetProperty("data").GetProperty("token").GetString());
        var before = await FixtureDatabase.Snapshot(connection);
        using var summary = await http.GetAsync("/api/v1/Inventory/stock-summary");
        Check(summary.StatusCode == HttpStatusCode.OK, "large-stock summary HTTP200");
        var data = (await summary.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");
        Check(data.GetProperty("totalQuantity").GetInt64() == expected, "HTTP JSON number accurately represents Int64 physical total");
        using var low = await http.GetAsync("/api/v1/Inventory/low-stock-alerts");
        Check(low.StatusCode == HttpStatusCode.OK, "large-stock low-stock alerts HTTP200");
        Check(before == await FixtureDatabase.Snapshot(connection), "read API smoke leaves database/audit unchanged");
        using var schema = await http.GetAsync("/openapi/v1.json");
        await File.WriteAllTextAsync(Path.Combine(report, "openapi.json"), await schema.Content.ReadAsStringAsync());
    }
    finally
    {
        if (!process.HasExited) process.Kill(entireProcessTree: true);
        await process.WaitForExitAsync();
        await File.WriteAllTextAsync(Path.Combine(report, "http-host.log"), await stdout + await stderr);
    }
}

sealed class FixtureUser : ICurrentUserService
{
    public string UserId => "B2Verification";
    public string Role => "Admin";
    public string IpAddress => "127.0.0.1";
}

sealed class FixtureDatabase : IAsyncDisposable
{
    private const string Prefix = "SmartWMS_B2_Verify_";
    public string Name { get; } = Prefix + Guid.NewGuid().ToString("N");
    public string Connection => $"Server=(localdb)\\MSSQLLocalDB;Database={Name};Integrated Security=true;TrustServerCertificate=true;Encrypt=false";
    public FixtureDatabase(string purpose) => Console.WriteLine("Fixture purpose: " + purpose);
    public async ValueTask DisposeAsync()
    {
        if (!Name.StartsWith(Prefix, StringComparison.Ordinal) || Name.Length != Prefix.Length + 32) throw new Exception("Unexpected cleanup target");
        SqlConnection.ClearAllPools();
        await using var db = new SqlConnection(new SqlConnectionStringBuilder(Connection) { InitialCatalog = "master" }.ConnectionString);
        await db.OpenAsync(); await using var cmd = db.CreateCommand();
        cmd.CommandText = $"IF DB_ID(N'{Name}') IS NOT NULL BEGIN ALTER DATABASE [{Name}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{Name}]; END";
        await cmd.ExecuteNonQueryAsync(); cmd.CommandText = $"SELECT COUNT(*) FROM sys.databases WHERE name=N'{Name}'";
        if ((int)(await cmd.ExecuteScalarAsync())! != 0) throw new Exception("Fixture cleanup failed");
        Console.WriteLine("CLEANUP VERIFIED: " + Name);
    }
    public static SqlException? Sql(Exception ex)
    {
        for (Exception? current = ex; current != null; current = current.InnerException) if (current is SqlException sql) return sql;
        return null;
    }
    public static async Task<string> Snapshot(string connection)
    {
        await using var db = new SqlConnection(connection); await db.OpenAsync(); await using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT QUOTENAME(SCHEMA_NAME(schema_id))+N'.'+QUOTENAME(name) FROM sys.tables ORDER BY 1";
        var tables = new List<string>(); await using (var r = await cmd.ExecuteReaderAsync()) while (await r.ReadAsync()) tables.Add(r.GetString(0));
        var data = new List<string>();
        foreach (var table in tables)
        {
            cmd.CommandText = $"SELECT * FROM {table}"; var rows = new List<string>(); await using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync()) { var values = new object[r.FieldCount]; r.GetValues(values);
                rows.Add(JsonSerializer.Serialize(values.Select(x => x is DBNull ? null : x is byte[] b ? Convert.ToHexString(b) : x))); }
            rows.Sort(StringComparer.Ordinal); data.Add(table + ":" + string.Join("\n", rows));
        }
        cmd.CommandText = "SELECT COALESCE((SELECT * FROM sys.columns ORDER BY object_id,column_id FOR JSON PATH),N'[]') + COALESCE((SELECT * FROM sys.indexes ORDER BY object_id,index_id FOR JSON PATH),N'[]') + COALESCE((SELECT * FROM sys.check_constraints ORDER BY object_id,parent_column_id,name FOR JSON PATH),N'[]')";
        data.Add((string)(await cmd.ExecuteScalarAsync())!);
        return Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(string.Join("\n", data))));
    }
}
