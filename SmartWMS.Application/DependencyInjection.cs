using FluentValidation;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using SmartWMS.Application.Common.Behaviors; // Thêm dòng này
using System.Reflection;

namespace SmartWMS.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        services.AddValidatorsFromAssembly(Assembly.GetExecutingAssembly());

        services.AddMediatR(cfg => {
            cfg.RegisterServicesFromAssembly(Assembly.GetExecutingAssembly());
            // Đăng ký Pipeline Behavior chặn request để Validate
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
        });

        return services;
    }
}