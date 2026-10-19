using FluentValidation;

namespace SmartWMS.Application.Features.Products.Commands.Create;

public sealed class CreateProductCommandValidator : AbstractValidator<CreateProductCommand>
{
    public CreateProductCommandValidator()
    {
        RuleFor(x => x.RequestData)
            .NotNull()
            .WithMessage("Dữ liệu đầu vào không được để trống.");

        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.Name)
                .NotEmpty().WithMessage("Tên sản phẩm không được để trống.")
                .MaximumLength(200).WithMessage("Tên sản phẩm không được vượt quá 200 ký tự.");

            RuleFor(x => x.RequestData.SKU)
                .NotEmpty().WithMessage("Mã SKU không được để trống.")
                .MaximumLength(50).WithMessage("Mã SKU không được vượt quá 50 ký tự.");
        });
    }
}