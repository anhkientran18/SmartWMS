using FluentValidation;

namespace SmartWMS.Application.Features.InventoryManagement.Queries.GetStockHistory;

public class GetStockHistoryQueryValidator : AbstractValidator<GetStockHistoryQuery>
{
    public GetStockHistoryQueryValidator()
    {
        RuleFor(x => x.RequestData).NotNull();
        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.PageIndex).GreaterThan(0);
            RuleFor(x => x.RequestData.PageSize).InclusiveBetween(1, 100);
        });
    }
}