using FluentValidation;

namespace SmartWMS.Application.Features.Products.Queries.GetProductQrCode;

public sealed class GetProductQrCodeQueryValidator : AbstractValidator<GetProductQrCodeQuery>
{
    public GetProductQrCodeQueryValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu không được để trống.");
        When(x => x.RequestData != null, () =>
        {
            RuleFor(v => v.RequestData.Sku)
                .NotEmpty().WithMessage("Mã SKU không được để trống.")
                .MaximumLength(50).WithMessage("Mã SKU không được vượt quá 50 ký tự.");
        });
    }
}