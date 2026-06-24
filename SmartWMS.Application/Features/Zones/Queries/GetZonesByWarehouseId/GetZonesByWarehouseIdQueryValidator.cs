using FluentValidation;

namespace SmartWMS.Application.Features.Zones.Queries.GetZonesByWarehouseId;

public class GetZonesByWarehouseIdQueryValidator : AbstractValidator<GetZonesByWarehouseIdQuery>
{
    public GetZonesByWarehouseIdQueryValidator()
    {
        RuleFor(v => v.WarehouseId)
            .NotEmpty().WithMessage("Mã định danh nhà kho (WarehouseId) không được để trống.");
    }
}