using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SmartWMS.Application;
using SmartWMS.Infrastructure;
using SmartWMS.Infrastructure.Persistence;
using System.Text;
using SmartWMS.Infrastructure.SignalR;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Infrastructure.Services;
using SmartWMS.Infrastructure.Persistence.DbContext;
using SmartWMS.Domain.Entities;
using Hangfire;
using Serilog;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;

var builder = WebApplication.CreateBuilder(args);

// ============================================================================
// 1. CẤU HÌNH SERILOG: Ghi log có cấu trúc song song ra Console và File JSON
// ============================================================================
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}")
    .WriteTo.File("Logs/smartwms-log-.txt", rollingInterval: RollingInterval.Day, outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] {Message:lj} {Properties:j}{NewLine}{Exception}")
    .CreateLogger();

builder.Host.UseSerilog();

// --- CẤU HÌNH HỆ THỐNG BẢO MẬT JWT TOKEN ---
var jwtSettings = builder.Configuration.GetSection("JwtSettings");
var secretKey = Encoding.UTF8.GetBytes(jwtSettings["Secret"]!);

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();
builder.Services.AddScoped<IApplicationDbContext>(provider =>
    provider.GetRequiredService<ApplicationDbContext>());

builder.Services.AddHttpClient<IAgentCapacityService, AgentCapacityService>();

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSettings["Issuer"],
        ValidAudience = jwtSettings["Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(secretKey)
    };
});

// --- ĐĂNG KÝ CÁC PHÂN TẦNG KIẾN TRÚC VÀ TIỆN ÍCH LÕI ---
builder.Services.Configure<SmartWMS.Application.Common.Models.Configurations.GeminiSettings>(
    builder.Configuration.GetSection(SmartWMS.Application.Common.Models.Configurations.GeminiSettings.SectionName));

builder.Services.AddInfrastructureServices(builder.Configuration);
builder.Services.AddApplicationServices();

builder.Services.AddScoped<IBarcodeService, BarcodeService>();
builder.Services.AddScoped<IInventoryJobService, InventoryJobService>();

builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddSignalR();

// Đăng ký dịch vụ Caching hỗ trợ Handlers và tối ưu tài nguyên hệ thống
builder.Services.AddMemoryCache();

// Đăng ký dịch vụ xử lý lỗi tập trung .NET 8 và cấu hình Problem Details mặc định
builder.Services.AddExceptionHandler<SmartWMS.Api.Middlewares.GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

// ============================================================================
// 2. ĐĂNG KÝ HEALTH CHECKS: Giám sát toàn diện tài nguyên lõi hệ thống
// ============================================================================
builder.Services.AddHealthChecks()
    .AddTypeActivatedCheck<SmartWMS.Infrastructure.HealthChecks.SqlStorageHealthCheck>("SQL-Server-Storage")
    .AddTypeActivatedCheck<SmartWMS.Infrastructure.HealthChecks.GeminiHealthCheck>("Google-Gemini-AI-Hub");

var app = builder.Build();

// ============================================================================
// CẤU HÌNH HTTP REQUEST PIPELINE (MIDDLEWARES ORDER)
// ============================================================================
app.UseExceptionHandler(); // 🌟 GIỮ LẠI: Lớp bọc lỗi tối cao của .NET 8 kết hợp với GlobalExceptionHandler
app.UseSerilogRequestLogging();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseInfrastructureLocalization();
app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.UseHangfireDashboard("/hangfire");
app.MapControllers();
app.MapHub<InventoryHub>("/hubs/inventory");

// ============================================================================
// 3. MAPPING ENDPOINT HEALTH CHECKS
// ============================================================================
app.MapHealthChecks("/healthz", new HealthCheckOptions
{
    ResponseWriter = async (context, report) =>
    {
        context.Response.ContentType = "application/json";
        var responseJson = new
        {
            Status = report.Status.ToString(),
            Duration = report.TotalDuration,
            Checks = report.Entries.Select(x => new
            {
                Component = x.Key,
                Status = x.Value.Status.ToString(),
                Description = x.Value.Description ?? "Không có mô tả.",
                Error = x.Value.Exception?.Message
            })
        };
        await context.Response.WriteAsJsonAsync(responseJson);
    }
});

// --- ĐOẠN CODE TỰ ĐỘNG KIỂM TRA & SEED DATA MỒI ---
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<ApplicationDbContext>();

        // 1. Tự động kiểm tra và cập nhật Database cấu trúc mới nhất
        context.Database.Migrate(); 

        // 🌟 BỔ SUNG: Khởi tạo tài khoản Admin hệ thống (Dùng file DbInitializer của bạn)
        await SmartWMS.Infrastructure.Persistence.DbInitializer.SeedAsync(context);
        Console.WriteLine("---> [SmartWMS] Kiểm tra/Khởi tạo tài khoản Admin hệ thống thành công!");

        // 2. Tự động tạo dữ liệu mẫu cho Kho bãi và Ô kệ (Bins) nếu trống
        if (!context.Warehouses.Any())
        {
            var warehouseId = Guid.Parse("7a9089f2-2b22-4211-912b-28562d2925a1");
            var dryZoneId = Guid.Parse("e84988e0-087e-40f4-904d-771804d9c02a");
            var coldZoneId = Guid.Parse("f2e96440-1996-4e5b-9d41-3b7c0604b087");
            var fixedDate = new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc);

            var warehouse = new Warehouse
            {
                Id = warehouseId,
                Name = "Kho Tổng Thông Minh - SmartWMS Center",
                Address = "Khu Công Nghệ Cao, Quận 9, TP. Thủ Đức",
                CreatedAt = fixedDate,
                CreatedBy = "SystemAdmin"
            };
            context.Warehouses.Add(warehouse);

            context.Zones.AddRange(
                new Zone { Id = dryZoneId, Name = "Khu Khô (Dry Zone)", WarehouseId = warehouseId, CreatedAt = fixedDate, CreatedBy = "SystemAdmin" },
                new Zone { Id = coldZoneId, Name = "Khu Mát (Cold Zone)", WarehouseId = warehouseId, CreatedAt = fixedDate, CreatedBy = "SystemAdmin" }
            );

            for (int i = 1; i <= 5; i++)
            {
                context.Bins.Add(new Bin
                {
                    Id = Guid.Parse($"c1000000-0000-0000-0000-00000000000{i}"),
                    Code = $"C-Z1-R{i}-L1",
                    ZoneId = coldZoneId,
                    MaxCapacity = 100,
                    CurrentOccupancy = 0,
                    CreatedAt = fixedDate,
                    CreatedBy = "SystemAdmin"
                });
            }

            for (int i = 1; i <= 5; i++)
            {
                context.Bins.Add(new Bin
                {
                    Id = Guid.Parse($"d2000000-0000-0000-0000-00000000000{i}"),
                    Code = $"D-Z2-R{i}-L1",
                    ZoneId = dryZoneId,
                    MaxCapacity = 500,
                    CurrentOccupancy = 0,
                    CreatedAt = fixedDate,
                    CreatedBy = "SystemAdmin"
                });
            }

            context.SaveChanges();
            Console.WriteLine("---> [SmartWMS] Khởi tạo dữ liệu mồi kho bãi thành công!");
        }

        // 3. Tự động đồng bộ danh mục sản phẩm và AI Vector thông minh
        var embeddingService = services.GetRequiredService<IEmbeddingService>();
        await SmartWMS.Infrastructure.Persistence.Initializers.InitialDbSeed.SeedDataAsync(context, embeddingService);
        Console.WriteLine("---> [SmartWMS] Đồng bộ danh mục sản phẩm và AI Vector thành công!");
    }
    catch (Exception ex)
    {
        Log.Error(ex, "Có lỗi xảy ra khi tự động seed dữ liệu kho và AI Vector.");
    }
}

// --- ĐĂNG KÝ CHẠY ĐỊNH KỲ CHO TÁC NHÂN ẢO VÀ NGHIỆP VỤ NỀN HANGFIRE ---
using (var scope = app.Services.CreateScope())
{
    var recurringJobManager = scope.ServiceProvider.GetRequiredService<IRecurringJobManager>();

    recurringJobManager.AddOrUpdate<IAIAgentJobService>(
        "SmartWMS-AI-VirtualAgent-Scan",
        job => job.ScanAndProactiveRestockAsync(),
        Cron.Hourly);

    recurringJobManager.AddOrUpdate<IInventoryJobService>(
        "SmartWMS-Inventory-FEFO-AutoLock",
        job => job.RunExpiredStockLockJobAsync(),
        Cron.Daily);
}

try
{
    Log.Information("🚀 Đang khởi động máy chủ Web API SmartWMS Center...");
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Máy chủ Web API đột ngột sập nguồn khi đang khởi chạy.");
}
finally
{
    Log.CloseAndFlush();
}