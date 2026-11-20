using FluentValidation;

namespace SmartWMS.Application.Features.Suppliers.Commands.UpdateSupplier;

public class UpdateSupplierCommandValidator : AbstractValidator<UpdateSupplierCommand>
{
    public UpdateSupplierCommandValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu không được trống.");
        When(x => x.RequestData != null, () =>
        {
            RuleFor(v => v.RequestData.Id)
                .NotEmpty().WithMessage("Mã định danh nhà cung cấp không được để trống.");

            RuleFor(v => v.RequestData.Code)
                .NotEmpty().WithMessage("Mã nhà cung cấp không được để trống.")
                .MaximumLength(50).WithMessage("Mã nhà cung cấp không được quá 50 ký tự.");

            RuleFor(v => v.RequestData.Name)
                .NotEmpty().WithMessage("Tên nhà cung cấp không được để trống.")
                .MaximumLength(200).WithMessage("Tên nhà cung cấp không được quá 200 ký tự.");

            RuleFor(v => v.RequestData.Email)
                .EmailAddress().When(v => !string.IsNullOrEmpty(v.RequestData.Email))
                .WithMessage("Định dạng email không hợp lệ.");
        });
    }
}