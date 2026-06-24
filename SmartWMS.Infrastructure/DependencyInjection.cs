using Hangfire;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Localization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Polly;
using Polly.Extensions.Http;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Infrastructure.Persistence.Interceptors;
using SmartWMS.Infrastructure.Services;
using SmartWMS.Infrastructure.SignalR;
using System.Globalization;

namespace SmartWMS.Infrastructure;

public static class InfrastructureConfiguration
{
    public static IServiceCollection AddInfrastructureServices(this IServiceCollection services, IConfiguration configuration)
    {
        // 1. Cấu hình dịch vụ Localization
        services.AddLocalization(options => options.ResourcesPath = "Localization");

        // 2. Đăng ký dịch vụ thông báo Real-time SignalR
        services.AddScoped<IInventoryNotificationService, InventoryNotificationService>();
        // Đăng ký dịch vụ điều phối phát sóng SignalR thời gian thực
        services.AddScoped<IInventoryHubService, SmartWMS.Infrastructure.SignalR.InventoryHubService>();

        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUserService, CurrentUserService>();

        // 3. Cấu hình Hangfire cho AI Virtual Agent
        services.AddHangfire(config => config
            .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
            .UseSimpleAssemblyNameTypeSerializer()
            .UseRecommendedSerializerSettings()
            .UseSqlServerStorage(configuration.GetConnectionString("DefaultConnection")));

        services.AddHangfireServer();
        services.AddScoped<IAIAgentJobService>(provider => provider.GetRequiredService<AIAgentJobService>());
        services.AddScoped<AIAgentJobService>();

        // 4. BỔ SUNG QUAN TRỌNG: Đăng ký các HttpClients gọi AI kèm theo cấu hình bảo vệ Polly 
        services.AddHttpClient<IAiChatService, GeminiChatService>()
            .AddPolicyHandler(GetRetryPolicy())
            .AddPolicyHandler(GetCircuitBreakerPolicy());

        services.AddHttpClient<IEmbeddingService, GeminiEmbeddingService>()
            .AddPolicyHandler(GetRetryPolicy())
            .AddPolicyHandler(GetCircuitBreakerPolicy());

        services.AddHttpClient<IAiInsightService, GeminiInsightService>()
            .AddPolicyHandler(GetRetryPolicy())
            .AddPolicyHandler(GetCircuitBreakerPolicy());
        // Đăng ký cổng kết nối Engine dự báo chuỗi thời gian kèm cơ chế bảo vệ ngắt mạch tự động của Polly
        services.AddHttpClient<IAiForecastingService, AiForecastingService>()
            .AddPolicyHandler(GetRetryPolicy())
            .AddPolicyHandler(GetCircuitBreakerPolicy());
        // Đăng ký bộ đánh chặn kiểm toán vào thùng chứa Scoped IoC
        services.AddScoped<AuditableEntityInterceptor>();
        // Đăng ký bộ máy tối ưu hóa định tuyến bốc hàng thông minh S-Shape
        services.AddSingleton<IPickingRouteOptimizer, SmartWMS.Infrastructure.Services.PickingRouteOptimizer>();

        return services;
    }

    // Cơ chế 1: Tự động thử lại (Retry Policy) khi gặp lỗi HTTP 5xx hoặc 408
    private static IAsyncPolicy<HttpResponseMessage> GetRetryPolicy()
    {
        return HttpPolicyExtensions
            .HandleTransientHttpError() // Bắt các lỗi HTTP 5xx, 408 hoặc lỗi kết nối mạng vật lý
            .OrResult(msg => msg.StatusCode == System.Net.HttpStatusCode.TooManyRequests) // Bắt thêm lỗi Rate Limit (429)
            .WaitAndRetryAsync(
                retryCount: 3, // Thử lại tối đa 3 lần
                sleepDurationProvider: retryAttempt => TimeSpan.FromSeconds(Math.Pow(2, retryAttempt)), // Thời gian chờ tăng dần: 2s, 4s, 8s
                onRetry: (outcome, timespan, retryAttempt, context) =>
                {
                    // Bạn có thể đặt log ở đây để theo dõi hệ thống đang tự thử lại
                    Console.WriteLine($"---> [Polly Retry] Lỗi kết nối AI. Đang thử lại lần thứ {retryAttempt} sau {timespan.TotalSeconds} giây...");
                });
    }

    // Cơ chế 2: Ngắt mạch tự động (Circuit Breaker Policy) bảo vệ hệ thống
    private static IAsyncPolicy<HttpResponseMessage> GetCircuitBreakerPolicy()
    {
        return HttpPolicyExtensions
            .HandleTransientHttpError()
            .CircuitBreakerAsync(
                handledEventsAllowedBeforeBreaking: 5, // Nếu bị lỗi liên tiếp 5 lần
                durationOfBreak: TimeSpan.FromSeconds(30), // Mạch sẽ NGẮT hoàn toàn trong 30 giây (Từ chối gọi lên Google để đỡ tốn tài nguyên)
                onBreak: (exception, timespan) =>
                {
                    Console.WriteLine($"---> [Polly CircuitBreaker] API Gemini gặp lỗi liên tiếp! NGẮT MẠCH trong {timespan.TotalSeconds} giây.");
                },
                onReset: () =>
                {
                    Console.WriteLine("---> [Polly CircuitBreaker] API Gemini đã ổn định trở lại. ĐÓNG MẠCH, kết nối bình thường.");
                });
    }

    public static IApplicationBuilder UseInfrastructureLocalization(this IApplicationBuilder app)
    {
        var supportedCultures = new[] { new CultureInfo("vi-VN"), new CultureInfo("en-US") };
        var localizationOptions = new RequestLocalizationOptions
        {
            DefaultRequestCulture = new RequestCulture("vi-VN"),
            SupportedCultures = supportedCultures,
            SupportedUICultures = supportedCultures
        };
        localizationOptions.RequestCultureProviders.Clear();
        localizationOptions.RequestCultureProviders.Add(new AcceptLanguageHeaderRequestCultureProvider());
        app.UseRequestLocalization(localizationOptions);
        return app;
    }
}