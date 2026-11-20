using FluentValidation;

namespace SmartWMS.Application.Features.Forecasts.Queries.GetStockForecast;

public class GetStockForecastQueryValidator : AbstractValidator<GetStockForecastQuery>
{
    public GetStockForecastQueryValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu không được để trống.");
        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.Sku).NotEmpty().WithMessage("Vui lòng cung cấp mã SKU cần dự báo.");
        });
    }
}