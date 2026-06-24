using FluentValidation;

namespace SmartWMS.Application.Features.Products.Queries.GetProductQrCode;

public class GetProductQrCodeQueryValidator : AbstractValidator<GetProductQrCodeQuery>
{
    public GetProductQrCodeQueryValidator()
    {
        RuleFor(v => v.Sku)
            .NotEmpty().WithMessage("Mã SKU không được để trống.")
            .MaximumLength(50).WithMessage("Mã SKU không được vượt quá 50 ký tự.");
    }
}