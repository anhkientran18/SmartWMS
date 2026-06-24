using FluentValidation;
using Microsoft.Extensions.Localization;
using SmartWMS.Domain.Localization;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.ValidatePackingWeight;

public class ValidatePackingWeightCommandValidator : AbstractValidator<ValidatePackingWeightCommand>
{
    public ValidatePackingWeightCommandValidator(IStringLocalizer<SharedResource> localizer)
    {
        // 1. Kiểm tra ID đơn hàng bắt buộc phải có thông tin
        RuleFor(v => v.OrderId)
            .NotEmpty()
            .WithMessage(_ => localizer["OrderId_Required"]);

        // 2. Kiểm tra tính hợp lệ của trọng lượng kiện hàng thực tế
        RuleFor(v => v.ActualWeight)
            .GreaterThan(0)
            .WithMessage(_ => localizer["Weight_GreaterThanZero"]); // Bản dịch: "Trọng lượng kiểm thử thùng hàng đóng gói bắt buộc phải lớn hơn 0"
    }
}