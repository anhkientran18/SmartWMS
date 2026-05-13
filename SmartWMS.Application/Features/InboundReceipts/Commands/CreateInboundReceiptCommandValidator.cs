using FluentValidation;
using Microsoft.Extensions.Localization;
using SmartWMS.Domain.Localization; // Namespace chứa SharedResource

namespace SmartWMS.Application.Features.InboundReceipts.Commands;

public class CreateInboundReceiptCommandValidator : AbstractValidator<CreateInboundReceiptCommand>
{
    public CreateInboundReceiptCommandValidator(IStringLocalizer<SharedResource> localizer)
    {
        RuleFor(v => v.SKU)
            .NotEmpty().WithMessage(_ => localizer["SKU_Required"]); // "SKU không được để trống"

        RuleFor(v => v.Quantity)
            .GreaterThan(0).WithMessage(_ => localizer["Quantity_GreaterThanZero"]); // "Số lượng phải > 0"

        RuleFor(v => v.BinId)
            .NotEmpty().WithMessage(_ => localizer["BinId_Required"]);
    }
}