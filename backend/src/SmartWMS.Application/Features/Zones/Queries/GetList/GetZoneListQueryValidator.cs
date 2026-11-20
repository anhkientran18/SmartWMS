using FluentValidation;

namespace SmartWMS.Application.Features.Zones.Queries.GetList;

public sealed class GetZoneListQueryValidator : AbstractValidator<GetZoneListQuery>
{
    public GetZoneListQueryValidator()
    {
        RuleFor(x => x.RequestData).NotNull();
    }
}