using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SmartWMS.Api.Middleware;
using SmartWMS.Application;
using SmartWMS.Infrastructure;
using SmartWMS.Infrastructure.Persistence;
using System.Text;
using SmartWMS.Infrastructure.SignalR;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Infrastructure.Services;

var builder = WebApplication.CreateBuilder(args);
var jwtSettings = builder.Configuration.GetSection("JwtSettings");
var secretKey = Encoding.UTF8.GetBytes(jwtSettings["Secret"]!);

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddHttpContextAccessor(); // Bắt buộc để đọc thông tin HttpContext
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>(); // Đăng ký Service đọc Token
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

builder.Services.AddInfrastructureLocalization();
builder.Services.AddApplicationServices();
builder.Services.AddHttpClient<IAiChatService, GeminiChatService>();
builder.Services.AddHttpClient<IEmbeddingService, GeminiEmbeddingService>();

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
builder.Services.AddSignalR();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseMiddleware<ExceptionHandlingMiddleware>();

app.UseInfrastructureLocalization();

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<InventoryHub>("/hubs/inventory");

// --- ĐOẠN CODE TỰ ĐỘNG KIỂM TRA & SEED DATA MỖI KHI NHẤN F5 ---
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<ApplicationDbContext>();

        // 1. Tự động cập nhật cấu trúc bảng nếu database chưa có
        if (context.Database.GetPendingMigrations().Any())
        {
            context.Database.Migrate();
        }

        // 2. Kiểm tra nếu hệ thống chưa cấu hình sơ đồ kho bãi (Bảng trống)
        if (!context.Warehouses.Any())
        {
            var warehouseId = Guid.Parse("7a9089f2-2b22-4211-912b-28562d2925a1");
            var dryZoneId = Guid.Parse("e84988e0-087e-40f4-904d-771804d9c02a");
            var coldZoneId = Guid.Parse("f2e96440-1996-4e5b-9d41-3b7c0604b087");
            var fixedDate = new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc);

            // Gieo dữ liệu Nhà Kho Tổng
            var warehouse = new Warehouse
            {
                Id = warehouseId,
                Name = "Kho Tổng Thông Minh - SmartWMS Center",
                Address = "Khu Công Nghệ Cao, Quận 9, TP. Thủ Đức",
                CreatedAt = fixedDate,
                CreatedBy = "SystemAdmin"
            };
            context.Warehouses.Add(warehouse);

            // Gieo dữ liệu Khu Vực (Zones)
            context.Zones.AddRange(
                new Zone { Id = dryZoneId, Name = "Khu Khô (Dry Zone)", WarehouseId = warehouseId, CreatedAt = fixedDate, CreatedBy = "SystemAdmin" },
                new Zone { Id = coldZoneId, Name = "Khu Mát (Cold Zone)", WarehouseId = warehouseId, CreatedAt = fixedDate, CreatedBy = "SystemAdmin" }
            );

            // Gieo dữ liệu Ô Kệ (Bins) mẫu cho Khu Mát
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

            // Gieo dữ liệu Ô Kệ (Bins) mẫu cho Khu Khô
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
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "Có lỗi xảy ra khi tự động seed dữ liệu kho.");
    }
}
// -------------------------------------------------------------

app.Run(); // Dòng app.Run() gốc của bạn giữ nguyên

app.Run();
