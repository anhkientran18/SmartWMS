using FluentValidation;
using Microsoft.Extensions.Localization;
using SmartWMS.Domain.Localization;

namespace SmartWMS.Application.Features.OutboundIssues.Queries;

public class GetOptimizedWavePickingQueryValidator : AbstractValidator<GetOptimizedWavePickingQuery>
{
    public GetOptimizedWavePickingQueryValidator(IStringLocalizer<SharedResource> localizer)
    {
        // Khóa chặt điều kiện: Danh sách đơn hàng gửi lên không được rỗng và phải chứa ít nhất 1 ID đơn hàng
        RuleFor(v => v.OrderIds)
            .NotEmpty()
            .WithMessage(_ => localizer["OrderIds_Required"])
            .Must(ids => ids != null && ids.Count > 0)
            .WithMessage(_ => localizer["OrderIds_MustContainItems"]); // Bản dịch đề xuất: "Vui lòng chọn ít nhất một đơn hàng xuất kho để lập đợt gom hàng (Wave)."
    }
}