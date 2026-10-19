using FluentValidation;

namespace SmartWMS.Application.Features.Dashboard.Queries.GetInboundOutboundChart;

public class GetInboundOutboundChartQueryValidator : AbstractValidator<GetInboundOutboundChartQuery>
{
    public GetInboundOutboundChartQueryValidator()
    {
        RuleFor(x => x.Days).InclusiveBetween(1, 365);
    }
}
