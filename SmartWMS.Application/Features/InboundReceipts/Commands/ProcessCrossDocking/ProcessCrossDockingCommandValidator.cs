using FluentValidation;
using Microsoft.Extensions.Localization;
using SmartWMS.Domain.Localization;

namespace SmartWMS.Application.Features.InboundReceipts.Commands.ProcessCrossDocking;

public class ProcessCrossDockingCommandValidator : AbstractValidator<ProcessCrossDockingCommand>
{
    public ProcessCrossDockingCommandValidator(IStringLocalizer<SharedResource> localizer)
    {
        // 1. Kiểm tra mã SKU sản phẩm nhập kho
        RuleFor(v => v.SKU)
            .NotEmpty()
            .WithMessage(_ => localizer["SKU_Required"])
            .MaximumLength(50)
            .WithMessage(_ => localizer["SKU_TooLong"]);

        // 2. Kiểm tra số lượng hàng nhận vào để quét Cross-Dock bắt buộc phải > 0
        RuleFor(v => v.ReceivedQuantity)
            .GreaterThan(0)
            .WithMessage(_ => localizer["ReceivedQuantity_GreaterThanZero"]); // Bản dịch đề xuất: "Số lượng hàng thực nhận chặng Cross-Dock phải lớn hơn 0."
    }
}