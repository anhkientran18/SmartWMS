using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Localization;
using Microsoft.Extensions.DependencyInjection;
using System.Globalization;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Infrastructure.SignalR;

namespace SmartWMS.Infrastructure;

public static class LocalizationConfiguration
{
    public static IServiceCollection AddInfrastructureLocalization(this IServiceCollection services)
    {
        // 1. Cấu hình dịch vụ Localization
        services.AddLocalization(options => options.ResourcesPath = "Localization");

        // 2. BỔ SUNG QUAN TRỌNG: Đăng ký dịch vụ thông báo Real-time SignalR vào DI container
        services.AddScoped<IInventoryNotificationService, InventoryNotificationService>();

        return services;
    }

    public static IApplicationBuilder UseInfrastructureLocalization(this IApplicationBuilder app)
    {
        // Thiết lập các ngôn ngữ hỗ trợ
        var supportedCultures = new[]
        {
            new CultureInfo("vi-VN"),
            new CultureInfo("en-US")
        };

        var localizationOptions = new RequestLocalizationOptions
        {
            // Thiết lập vi-VN làm mặc định
            DefaultRequestCulture = new RequestCulture("vi-VN"),
            SupportedCultures = supportedCultures,
            SupportedUICultures = supportedCultures
        };

        // Cấu hình Middleware nhận diện qua Header Accept-Language 
        localizationOptions.RequestCultureProviders.Clear();
        localizationOptions.RequestCultureProviders.Add(new AcceptLanguageHeaderRequestCultureProvider());

        app.UseRequestLocalization(localizationOptions);

        return app;
    }
}