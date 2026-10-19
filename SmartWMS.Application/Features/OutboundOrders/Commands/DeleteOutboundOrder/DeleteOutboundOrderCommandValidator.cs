using FluentValidation;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.DeleteOutboundOrder;

public class DeleteOutboundOrderCommandValidator : AbstractValidator<DeleteOutboundOrderCommand>
{
    public DeleteOutboundOrderCommandValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu không được trống.");
        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.Id)
                .NotEmpty().WithMessage("Mã đơn xuất kho cần xóa không được để trống.");
        });
    }
}