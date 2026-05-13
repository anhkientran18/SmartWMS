using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Localization;
using Microsoft.Extensions.DependencyInjection;
using System.Globalization;

namespace SmartWMS.Infrastructure;

public static class LocalizationConfiguration
{
    public static IServiceCollection AddInfrastructureLocalization(this IServiceCollection services)
    {
        // 1. Cấu hình dịch vụ Localization
        services.AddLocalization(options => options.ResourcesPath = "Localization");

        return services;
    }

    public static IApplicationBuilder UseInfrastructureLocalization(this IApplicationBuilder app)
    {
        // 2. Thiết lập các ngôn ngữ hỗ trợ [cite: 437]
        var supportedCultures = new[]
        {
            new CultureInfo("vi-VN"),
            new CultureInfo("en-US")
        };

        var localizationOptions = new RequestLocalizationOptions
        {
            // Thiết lập vi-VN làm mặc định [cite: 437]
            DefaultRequestCulture = new RequestCulture("vi-VN"),
            SupportedCultures = supportedCultures,
            SupportedUICultures = supportedCultures
        };

        // 3. Cấu hình Middleware nhận diện qua Header Accept-Language 
        // Mặc định RequestLocalizationOptions đã bao gồm AcceptLanguageHeaderRequestCultureProvider
        localizationOptions.RequestCultureProviders.Clear();
        localizationOptions.RequestCultureProviders.Add(new AcceptLanguageHeaderRequestCultureProvider());

        app.UseRequestLocalization(localizationOptions);

        return app;
    }
}