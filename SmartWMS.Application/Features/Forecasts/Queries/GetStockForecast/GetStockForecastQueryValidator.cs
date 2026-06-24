using FluentValidation;
using Microsoft.Extensions.Localization;
using SmartWMS.Domain.Localization;

namespace SmartWMS.Application.Features.Forecasts.Queries.GetStockForecast;

public class GetStockForecastQueryValidator : AbstractValidator<GetStockForecastQuery>
{
    public GetStockForecastQueryValidator(IStringLocalizer<SharedResource> localizer)
    {
        RuleFor(v => v.SKU)
            .NotEmpty()
            .WithMessage(_ => localizer["SKU_Required"])
            .MaximumLength(50)
            .WithMessage(_ => localizer["SKU_TooLong"]);
    }
}