using Hangfire;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Localization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MediatR;
using Polly;
using Polly.Extensions.Http;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models.Configurations;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Dashboard.DTOs.Queries;
using SmartWMS.Application.Features.Dashboard.Queries.GetAIAgentMetrics;
using SmartWMS.Infrastructure.Persistence.Interceptors;
using SmartWMS.Infrastructure.Persistence.Repositories;
using SmartWMS.Infrastructure.Services;
using SmartWMS.Infrastructure.SignalR;
using System;
using System.Globalization;
using System.Net.Http;

namespace SmartWMS.Infrastructure;

public static class InfrastructureConfiguration
{
    public static IServiceCollection AddInfrastructureServices(this IServiceCollection services, IConfiguration configuration)
    {
        // 1. Cấu hình Gemini Settings từ appsettings.json
        services.Configure<GeminiSettings>(configuration.GetSection(GeminiSettings.SectionName));

        // 2. Cấu hình dịch vụ Localization
        services.AddLocalization(options => options.ResourcesPath = "Localization");

        // 3. Đăng ký dịch vụ Authentication & Password Hashing
        services.AddScoped<ITokenService, JwtTokenService>();
        services.AddScoped<IPasswordHasher, PasswordHasher>();

        // 4. Đăng ký dịch vụ thông báo Real-time SignalR
        services.AddScoped<IInventoryNotificationService, InventoryNotificationService>();
        services.AddScoped<IInventoryHubService, SmartWMS.Infrastructure.SignalR.InventoryHubService>();

        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUserService, CurrentUserService>();

        services.AddScoped<IAIAgentJobService>(provider => provider.GetRequiredService<AIAgentJobService>());
        services.AddScoped<AIAgentJobService>();
        services.AddScoped<IRequestHandler<GetAIAgentMetricsQuery, Result<AIAgentMetricsDto>>, GetAIAgentMetricsQueryHandler>();

        // 6. Cấu hình HttpClients gọi Gemini AI kèm cơ chế bảo vệ Polly (Retry & Circuit Breaker)
        services.AddHttpClient<IAiInsightService, GeminiInsightService>()
            .AddPolicyHandler(GetRetryPolicy())
            .AddPolicyHandler(GetCircuitBreakerPolicy());

        services.AddHttpClient<IEmbeddingService, GeminiEmbeddingService>()
            .AddPolicyHandler(GetRetryPolicy())
            .AddPolicyHandler(GetCircuitBreakerPolicy());

        services.AddHttpClient<IAiChatService, GeminiChatService>()
            .AddPolicyHandler(GetRetryPolicy())
            .AddPolicyHandler(GetCircuitBreakerPolicy());

        services.AddHttpClient<IAiForecastingService, AiForecastingService>()
            .AddPolicyHandler(GetRetryPolicy())
            .AddPolicyHandler(GetCircuitBreakerPolicy());

        // 7. Đăng ký AI Agent Services & Utility Services
        services.AddScoped<IAgentCapacityService, AgentCapacityService>();
        services.AddSingleton<IPickingRouteOptimizer, SmartWMS.Infrastructure.Services.PickingRouteOptimizer>();

        // 8. Đăng ký bộ đánh chặn kiểm toán (Audit Interceptor)
        services.AddScoped<AuditableEntityInterceptor>();

        // 9. Đăng ký Generic Repository và UnitOfWork
        services.AddScoped(typeof(IGenericRepository<>), typeof(GenericRepository<>));
        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped<IInventoryMutationCoordinator, InventoryMutationCoordinator>();
        services.AddScoped<ICycleCountCoordinator, CycleCountCoordinator>();
        services.AddScoped<IInboundReceiveCoordinator, InboundReceiveCoordinator>();

        return services;
    }

    private static IAsyncPolicy<HttpResponseMessage> GetRetryPolicy()
    {
        return HttpPolicyExtensions
            .HandleTransientHttpError()
            .OrResult(msg => msg.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
            .WaitAndRetryAsync(
                retryCount: 3,
                sleepDurationProvider: retryAttempt => TimeSpan.FromSeconds(Math.Pow(2, retryAttempt)),
                onRetry: (outcome, timespan, retryAttempt, context) =>
                {
                    Console.WriteLine($"---> [Polly Retry] Lỗi kết nối AI. Đang thử lại lần thứ {retryAttempt} sau {timespan.TotalSeconds} giây...");
                });
    }

    private static IAsyncPolicy<HttpResponseMessage> GetCircuitBreakerPolicy()
    {
        return HttpPolicyExtensions
            .HandleTransientHttpError()
            .CircuitBreakerAsync(
                handledEventsAllowedBeforeBreaking: 5,
                durationOfBreak: TimeSpan.FromSeconds(30),
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
