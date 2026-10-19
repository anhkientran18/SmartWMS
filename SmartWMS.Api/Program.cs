using System;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Hangfire;
using Hangfire.SqlServer;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using SmartWMS.Api.Extensions;
using SmartWMS.Api.Middleware;
using SmartWMS.Api.Middlewares;
using SmartWMS.Application;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Domain.Entities;
using SmartWMS.Infrastructure;
using SmartWMS.Infrastructure.Persistence.DbContext;
using SmartWMS.Infrastructure.Persistence.Initializers;
using SmartWMS.Infrastructure.Services;
using SmartWMS.Infrastructure.SignalR;

var builder = WebApplication.CreateBuilder(args);

// ============================================================================
// 1. GHI LOG HỆ THỐNG VỚI SERILOG
// ============================================================================
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}")
    .WriteTo.File("Logs/smartwms-log-.txt", rollingInterval: RollingInterval.Day)
    .CreateLogger();

builder.Host.UseSerilog();

// ============================================================================
// 2. KẾT NỐI DATABASE VÀ ĐĂNG KÝ DEPENDENCY INJECTION
// ============================================================================
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();
builder.Services.AddScoped<IApplicationDbContext>(provider =>
    provider.GetRequiredService<ApplicationDbContext>());

// Cấu hình Gemini Settings và tầng lõi
builder.Services.Configure<SmartWMS.Application.Common.Models.Configurations.GeminiSettings>(
    builder.Configuration.GetSection(SmartWMS.Application.Common.Models.Configurations.GeminiSettings.SectionName));

builder.Services.AddInfrastructureServices(builder.Configuration);
builder.Services.AddApplicationServices();

builder.Services.AddScoped<IBarcodeService, BarcodeService>();
builder.Services.AddScoped<IInventoryJobService, InventoryJobService>();

// Đăng ký dịch vụ Hangfire Storage (Ưu tiên HangfireConnection độc lập nếu có)
string hangfireConnectionString = builder.Configuration.GetConnectionString("HangfireConnection")
    ?? builder.Configuration.GetConnectionString("DefaultConnection")!;

builder.Services.AddHangfire(config => config
    .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
    .UseSimpleAssemblyNameTypeSerializer()
    .UseRecommendedSerializerSettings()
    .UseSqlServerStorage(hangfireConnectionString, new SqlServerStorageOptions
    {
        CommandBatchMaxTimeout = TimeSpan.FromMinutes(5),
        SlidingInvisibilityTimeout = TimeSpan.FromMinutes(5),
        QueuePollInterval = TimeSpan.Zero,
        UseRecommendedIsolationLevel = true,
        DisableGlobalLocks = true
    }));

builder.Services.AddHangfireServer(options =>
{
    options.WorkerCount = Environment.ProcessorCount * 2;
});

// ============================================================================
// 3. CẤU HÌNH JWT AUTHENTICATION
// ============================================================================
var jwtSettings = builder.Configuration.GetSection("JwtSettings");
var jwtSecret = jwtSettings["Secret"];
if (string.IsNullOrWhiteSpace(jwtSecret) || Encoding.UTF8.GetByteCount(jwtSecret) < 32)
    throw new InvalidOperationException("Cần cấu hình JwtSettings:Secret bên ngoài source với ít nhất 32 byte.");
var secretKey = Encoding.UTF8.GetBytes(jwtSecret);

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
        IssuerSigningKey = new SymmetricSecurityKey(secretKey),
        ClockSkew = TimeSpan.Zero
    };

    // Chuẩn thực tế cho SignalR: Trích xuất JWT Token từ Query String khi kết nối WebSockets
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});

// ============================================================================
// 4. CẤU HÌNH CORS
// ============================================================================
const string SmartWmsCorsPolicy = "SmartWmsCorsPolicy";
builder.Services.AddCors(options =>
{
    options.AddPolicy(SmartWmsCorsPolicy, policy =>
    {
        policy.SetIsOriginAllowed(origin =>
        {
            if (string.IsNullOrWhiteSpace(origin)) return false;
            var uri = new Uri(origin);
            return uri.Host == "localhost" || uri.Host == "127.0.0.1";
        })
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials(); // Bắt buộc cho SignalR Hub
    });
});

// ============================================================================
// 5. TIỆN ÍCH LÕI, CONTROLLERS & OPENAPI GỐC
// ============================================================================
builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddSignalR();
builder.Services.AddMemoryCache();
builder.Services.AddExceptionHandler<SmartWMS.Api.Middlewares.GlobalExceptionHandler>();
builder.Services.AddProblemDetails();
builder.Services.AddApiVersioningConfig();

builder.Services.AddHealthChecks()
    .AddTypeActivatedCheck<SmartWMS.Infrastructure.HealthChecks.SqlStorageHealthCheck>("SQL-Server-Storage")
    .AddTypeActivatedCheck<SmartWMS.Infrastructure.HealthChecks.GeminiHealthCheck>("Google-Gemini-AI-Hub");

var app = builder.Build();

// ============================================================================
// 6. THỨ TỰ THI HÀNH PIPELINE & MIDDLEWARES
// ============================================================================
app.UseExceptionHandler();
app.UseSerilogRequestLogging();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/openapi/v1.json", "SmartWMS API Center v1");
        c.RoutePrefix = "swagger";
    });
}

app.UseInfrastructureLocalization();
app.UseHttpsRedirection();

// CORS bắt buộc đứng trước Middleware Tracking, Authentication & Authorization
app.UseCors(SmartWmsCorsPolicy);

// Bổ sung Middleware theo dõi vết Request
app.UseMiddleware<CorrelationIdMiddleware>();

app.UseAuthentication();
app.UseAuthorization();

app.UseHangfireDashboard("/hangfire");
app.MapControllers();
app.MapHub<InventoryHub>("/hubs/inventory");

// Endpoint Health Check
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
                Error = app.Environment.IsDevelopment() ? x.Value.Exception?.Message : null
            })
        };
        await context.Response.WriteAsJsonAsync(responseJson);
    }
});

// ============================================================================
// 7. MIGRATION DATABASE, SEED DATA VÀ RECURRING JOBS
// ============================================================================
try
{
    await SeedDatabaseAsync(app);
    RegisterBackgroundJobs(app);
    Log.Information("🚀 Đang khởi chạy máy chủ Web API SmartWMS Center...");
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Máy chủ Web API đột ngột dừng hoạt động.");
    throw;
}
finally
{
    Log.CloseAndFlush();
}

// ============================================================================
// CÁC HÀM TIỆN ÍCH BỔ TRỢ
// ============================================================================
static async Task SeedDatabaseAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<ApplicationDbContext>();

        if (app.Environment.IsDevelopment())
        {
            await context.Database.MigrateAsync();
        }

        var embeddingService = services.GetRequiredService<IEmbeddingService>();
        var passwordHasher = services.GetRequiredService<IPasswordHasher>();
        await DbInitializer.SeedAsync(context, passwordHasher, app.Configuration, embeddingService);
    }
    catch (Exception ex)
    {
        Log.Error(ex, "Lỗi xảy ra trong quá trình khởi tạo dữ liệu CSDL ban đầu.");
        throw;
    }
}

static void RegisterBackgroundJobs(WebApplication app)
{
    using var scope = app.Services.CreateScope();
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
