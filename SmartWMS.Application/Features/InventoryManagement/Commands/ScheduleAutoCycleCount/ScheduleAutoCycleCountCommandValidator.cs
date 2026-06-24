using FluentValidation;
using Microsoft.Extensions.Localization;
using SmartWMS.Domain.Localization;

namespace SmartWMS.Application.Features.InventoryManagement.Commands.ScheduleAutoCycleCount;

public class ScheduleAutoCycleCountCommandValidator : AbstractValidator<ScheduleAutoCycleCountCommand>
{
    public ScheduleAutoCycleCountCommandValidator(IStringLocalizer<SharedResource> localizer)
    {
        // RÀNG BUỘC NGƯỠNG GIAO DỊCH: Ngưỡng kích hoạt kiểm kê bắt buộc phải lớn hơn 0
        RuleFor(v => v.TransactionThreshold)
            .GreaterThan(0)
            .WithMessage(_ => localizer["TransactionThreshold_GreaterThanZero"]); // Bản dịch đề xuất: "Ngưỡng tần suất giao dịch để kích hoạt kiểm kê tự động phải lớn hơn 0."
    }
}