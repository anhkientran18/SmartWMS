using FluentValidation;

namespace SmartWMS.Application.Features.Warehouses.Queries.GetWarehouseById;

public class GetWarehouseByIdQueryValidator : AbstractValidator<GetWarehouseByIdQuery>
{
    public GetWarehouseByIdQueryValidator()
    {
        RuleFor(v => v.Id)
            .NotEmpty().WithMessage("Mã định danh nhà kho (Id) không được để trống.");
    }
}