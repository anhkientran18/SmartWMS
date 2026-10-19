using FluentValidation;
using System;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.UpdateOutboundOrder;

public class UpdateOutboundOrderCommandValidator : AbstractValidator<UpdateOutboundOrderCommand>
{
    public UpdateOutboundOrderCommandValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu cập nhật không được trống.");
        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.Id)
                .NotEmpty().WithMessage("Mã đơn xuất kho không được để trống.");

            RuleFor(x => x.RequestData.Items)
                .NotEmpty().WithMessage("Danh sách mặt hàng xuất không được để trống.");

            RuleForEach(x => x.RequestData.Items).ChildRules(items =>
            {
                items.RuleFor(i => i.ProductId)
                    .NotEmpty().WithMessage("Mã sản phẩm không được để trống.");
                items.RuleFor(i => i.RequestedQuantity)
                    .GreaterThan(0).WithMessage("Số lượng yêu cầu xuất phải lớn hơn 0.");
            });
        });
    }
}