using FluentValidation;
using Microsoft.Extensions.Localization;
using SmartWMS.Domain.Localization;

namespace SmartWMS.Application.Features.Products.Queries.ParseBarcode;

public class ParseBarcodeQueryValidator : AbstractValidator<ParseBarcodeQuery>
{
    public ParseBarcodeQueryValidator(IStringLocalizer<SharedResource> localizer)
    {
        // Chặn đứng trường hợp công nhân vô tình bấm quét trượt hoặc thiết bị gửi chuỗi trống lên Server
        RuleFor(v => v.RawBarcodeData)
            .NotEmpty()
            .WithMessage(_ => localizer["RawBarcodeData_Required"])
            .MaximumLength(150)
            .WithMessage(_ => localizer["RawBarcodeData_TooLong"]);
    }
}