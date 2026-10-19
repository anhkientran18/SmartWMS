using FluentValidation;

namespace SmartWMS.Application.Features.Warehouses.Commands.CreateWarehouse;

public class CreateWarehouseCommandValidator : AbstractValidator<CreateWarehouseCommand>
{
    public CreateWarehouseCommandValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu không được trống.");
        When(x => x.RequestData != null, () =>
        {
            RuleFor(v => v.RequestData.Code)
                .NotEmpty().WithMessage("Mã kho không được để trống.")
                .MaximumLength(50).WithMessage("Mã kho không được quá 50 ký tự.");

            RuleFor(v => v.RequestData.Name)
                .NotEmpty().WithMessage("Tên kho không được để trống.")
                .MaximumLength(200).WithMessage("Tên kho không được quá 200 ký tự.");
        });
    }
}