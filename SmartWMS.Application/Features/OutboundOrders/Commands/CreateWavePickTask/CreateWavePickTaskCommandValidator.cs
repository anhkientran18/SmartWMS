using FluentValidation;
using Microsoft.Extensions.Localization;
using SmartWMS.Domain.Localization;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.CreateWavePickTask;

public class CreateWavePickTaskCommandValidator : AbstractValidator<CreateWavePickTaskCommand>
{
    public CreateWavePickTaskCommandValidator(IStringLocalizer<SharedResource> localizer)
    {
        RuleFor(v => v.OrderIds)
            .NotEmpty()
            .WithMessage(_ => localizer["OrderIds_Required"]) // Bản dịch: "Danh sách đơn hàng gộp sóng xuất kho không được để trống"
            .Must(ids => ids != null && ids.Count > 0)
            .WithMessage(_ => localizer["OrderIds_MustContainItems"]); // Bản dịch: "Phải chọn tối thiểu một đơn hàng để khởi tạo đợt sóng bốc hàng"
    }
}