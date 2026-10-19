using Microsoft.AspNetCore.Mvc;

namespace SmartWMS.Api.Extensions;

public static class ApiVersioningExtensions
{
    public static IServiceCollection AddApiVersioningConfig(
        this IServiceCollection services)
    {
        services.AddApiVersioning(options =>
        {
            // Mặc định là Version 1.0
            options.DefaultApiVersion = new ApiVersion(1, 0);

            // Nếu người dùng không gửi version, lấy mặc định
            options.AssumeDefaultVersionWhenUnspecified = true;

            // Trả về thông tin Version trong Header của Response (api-supported-versions)
            options.ReportApiVersions = true;
        });

        // Cấu hình hiển thị đúng định dạng Version trên Swagger (v1, v2...)
        services.AddVersionedApiExplorer(options =>
        {
            options.GroupNameFormat = "'v'VVV";
            options.SubstituteApiVersionInUrl = true;
        });

        return services;
    }
}