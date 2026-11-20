using FluentValidation;

namespace SmartWMS.Application.Features.Suppliers.Commands.DeleteSupplier;

public class DeleteSupplierCommandValidator : AbstractValidator<DeleteSupplierCommand>
{
    public DeleteSupplierCommandValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu không được trống.");
        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.Id)
                .NotEmpty().WithMessage("Vui lòng cung cấp mã định danh (Id) nhà cung cấp cần xóa.");
        });
    }
}