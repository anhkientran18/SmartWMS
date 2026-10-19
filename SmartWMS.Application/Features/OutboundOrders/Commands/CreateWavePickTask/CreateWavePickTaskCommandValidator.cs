using FluentValidation;
using System.Linq;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.CreateWavePickTask;

public class CreateWavePickTaskCommandValidator : AbstractValidator<CreateWavePickTaskCommand>
{
    public CreateWavePickTaskCommandValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu không được trống.");
        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.OutboundOrderIds)
                .NotEmpty().WithMessage("Vui lòng chọn danh sách đơn hàng xuất cần gom chuyến.")
                .Must(ids => ids != null && ids.Any()).WithMessage("Danh sách đơn hàng trống.")
                .Must(ids => ids != null && ids.Count > 1).WithMessage("Gom chuyến (Wave Pick) yêu cầu ít nhất 2 đơn hàng xuất.");
        });
    }
}