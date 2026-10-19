using FluentValidation;

namespace SmartWMS.Application.Features.Warehouses.Commands.UpdateWarehouse;

public class UpdateWarehouseCommandValidator : AbstractValidator<UpdateWarehouseCommand>
{
    public UpdateWarehouseCommandValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu không được trống.");
        When(x => x.RequestData != null, () =>
        {
            RuleFor(v => v.RequestData.Id).NotEmpty().WithMessage("Mã định danh kho không được trống.");
            RuleFor(v => v.RequestData.Code).NotEmpty().MaximumLength(50);
            RuleFor(v => v.RequestData.Name).NotEmpty().MaximumLength(200);
        });
    }
}