using FluentValidation;

namespace SmartWMS.Application.Features.Products.Queries.ParseBarcode;

public sealed class ParseBarcodeQueryValidator : AbstractValidator<ParseBarcodeQuery>
{
    public ParseBarcodeQueryValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu không được để trống.");
        When(x => x.RequestData != null, () =>
        {
            RuleFor(v => v.RequestData.RawBarcodeData)
                .NotEmpty().WithMessage("Dữ liệu mã vạch quét từ thiết bị trống.")
                .MaximumLength(163).WithMessage("Dữ liệu quá dài.");
        });
    }
}