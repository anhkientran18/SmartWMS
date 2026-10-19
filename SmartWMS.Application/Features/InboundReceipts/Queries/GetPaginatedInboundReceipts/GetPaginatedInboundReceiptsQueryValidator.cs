using FluentValidation;

namespace SmartWMS.Application.Features.InboundReceipts.Queries.GetPaginatedInboundReceipts;

public class GetPaginatedInboundReceiptsQueryValidator : AbstractValidator<GetPaginatedInboundReceiptsQuery>
{
    public GetPaginatedInboundReceiptsQueryValidator()
    {
        RuleFor(x => x.RequestData).NotNull();
        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.PageIndex).GreaterThan(0);
            RuleFor(x => x.RequestData.PageSize).GreaterThan(0).LessThanOrEqualTo(100);
        });
    }
}