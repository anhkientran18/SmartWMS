using FluentValidation;

namespace SmartWMS.Application.Features.Zones.Queries.GetPaginatedZones;

public sealed class GetPaginatedZonesQueryValidator : AbstractValidator<GetPaginatedZonesQuery>
{
    public GetPaginatedZonesQueryValidator()
    {
        RuleFor(x => x.RequestData).NotNull();
        When(x => x.RequestData != null, () => {
            RuleFor(x => x.RequestData.PageIndex).GreaterThan(0);
            RuleFor(x => x.RequestData.PageSize).GreaterThan(0).LessThanOrEqualTo(100);
        });
    }
}