using FluentValidation;
using Microsoft.Extensions.Localization;
using SmartWMS.Domain.Localization;

namespace SmartWMS.Application.Features.Products.Commands;

public class CreateProductCommandValidator : AbstractValidator<CreateProductCommand>
{
    public CreateProductCommandValidator(IStringLocalizer<SharedResource> localizer)
    {
        RuleFor(v => v.SKU)
            .NotEmpty().WithMessage(_ => localizer["SKU_Required"])
            .MaximumLength(50).WithMessage("SKU không được vượt quá 50 ký tự.");

        RuleFor(v => v.Name)
            .NotEmpty().WithMessage("Tên sản phẩm không được để trống.");

        RuleFor(v => v.Width).GreaterThan(0).WithMessage("Chiều rộng phải lớn hơn 0.");
        RuleFor(v => v.Height).GreaterThan(0).WithMessage("Chiều cao phải lớn hơn 0.");
        RuleFor(v => v.Depth).GreaterThan(0).WithMessage("Chiều sâu phải lớn hơn 0.");
    }
}