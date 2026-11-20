using FluentValidation;
using System;

namespace SmartWMS.Application.Features.CycleCounting.Commands.ScheduleAutoCycleCount;

public class ScheduleAutoCycleCountCommandValidator : AbstractValidator<ScheduleAutoCycleCountCommand>
{
    public ScheduleAutoCycleCountCommandValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu không được để trống.");
        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.ZoneId)
                .NotEmpty().NotEqual(Guid.Empty).WithMessage("Vui lòng chọn Khu vực (Zone) cần lên lịch kiểm kê.");

            RuleFor(x => x.RequestData.CronExpression)
                .NotEmpty().WithMessage("Vui lòng cung cấp chu kỳ chạy (Cron Expression).");
        });
    }
}