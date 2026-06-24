using FluentValidation;
using Microsoft.Extensions.Localization;
using SmartWMS.Domain.Localization;

namespace SmartWMS.Application.Features.CycleCounting.Queries.GetPendingCountTasks;

public class GetPendingCountTasksQueryValidator : AbstractValidator<GetPendingCountTasksQuery>
{
    public GetPendingCountTasksQueryValidator(IStringLocalizer<SharedResource> localizer)
    {
        // Bắt buộc phải có tên nhân viên để phân bổ đúng danh sách nhiệm vụ kiểm kê
        RuleFor(v => v.OperatorName)
            .NotEmpty()
            .WithMessage(_ => localizer["OperatorName_Required"]) // Bản dịch đề xuất: "Tên nhân viên thực hiện kiểm kê không được để trống."
            .MaximumLength(100)
            .WithMessage(_ => localizer["OperatorName_TooLong"]);
    }
}