using FluentValidation;

namespace SmartWMS.Application.Features.Suppliers.Commands.CreateSupplier;

public sealed class CreateSupplierCommandValidator : AbstractValidator<CreateSupplierCommand>
{
    public CreateSupplierCommandValidator()
    {
        RuleFor(x => x.RequestData)
            .NotNull().WithMessage("Dữ liệu đầu vào không được để trống.");

        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.Code)
                .NotEmpty().WithMessage("Mã nhà cung cấp không được để trống.")
                .MaximumLength(50).WithMessage("Mã nhà cung cấp không được vượt quá 50 ký tự.");

            RuleFor(x => x.RequestData.Name)
                .NotEmpty().WithMessage("Tên nhà cung cấp không được để trống.")
                .MaximumLength(200).WithMessage("Tên nhà cung cấp không được vượt quá 200 ký tự.");

            RuleFor(x => x.RequestData.Email)
                .EmailAddress().WithMessage("Định dạng Email không hợp lệ.")
                .MaximumLength(100).WithMessage("Email không được vượt quá 100 ký tự.")
                .When(x => !string.IsNullOrWhiteSpace(x.RequestData.Email)); // Chỉ validate nếu có nhập Email

            RuleFor(x => x.RequestData.Phone)
                .MaximumLength(20).WithMessage("Số điện thoại không được vượt quá 20 ký tự.");
        });
    }
}