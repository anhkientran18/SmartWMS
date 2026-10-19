using FluentValidation;

namespace SmartWMS.Application.Features.Customers.Commands.CreateCustomer;

public class CreateCustomerCommandValidator : AbstractValidator<CreateCustomerCommand>
{
    public CreateCustomerCommandValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu không được trống.");
        When(x => x.RequestData != null, () =>
        {
            RuleFor(v => v.RequestData.Code)
                .NotEmpty().WithMessage("Mã khách hàng không được để trống.")
                .MaximumLength(50).WithMessage("Mã khách hàng không được quá 50 ký tự.");

            RuleFor(v => v.RequestData.Name)
                .NotEmpty().WithMessage("Tên khách hàng không được để trống.")
                .MaximumLength(200).WithMessage("Tên khách hàng không được quá 200 ký tự.");

            RuleFor(v => v.RequestData.Email)
                .EmailAddress().When(v => !string.IsNullOrEmpty(v.RequestData.Email))
                .WithMessage("Định dạng email không hợp lệ.");
        });
    }
}