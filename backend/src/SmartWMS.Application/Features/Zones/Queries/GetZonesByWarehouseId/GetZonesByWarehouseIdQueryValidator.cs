using FluentValidation;
using System;

namespace SmartWMS.Application.Features.Zones.Queries.GetZonesByWarehouseId;

public sealed class GetZonesByWarehouseIdQueryValidator : AbstractValidator<GetZonesByWarehouseIdQuery>
{
    public GetZonesByWarehouseIdQueryValidator()
    {
        RuleFor(x => x.RequestData).NotNull();
        When(x => x.RequestData != null, () => {
            RuleFor(x => x.RequestData.WarehouseId).NotEmpty().NotEqual(Guid.Empty);
        });
    }
}