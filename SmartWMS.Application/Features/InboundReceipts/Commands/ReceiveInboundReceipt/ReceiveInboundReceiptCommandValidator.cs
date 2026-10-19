using FluentValidation;
using System;
using System.Linq;

namespace SmartWMS.Application.Features.InboundReceipts.Commands.ReceiveInboundReceipt;

public class ReceiveInboundReceiptCommandValidator : AbstractValidator<ReceiveInboundReceiptCommand>
{
    public ReceiveInboundReceiptCommandValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu nhận hàng không được trống.");

        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.InboundReceiptId)
                .NotEmpty().WithMessage("Mã phiếu nhập không hợp lệ.")
                .NotEqual(Guid.Empty);

            RuleFor(x => x.RequestData.ReceivedItems)
                .NotEmpty().WithMessage("Vui lòng cung cấp danh sách mặt hàng đã kiểm đếm.")
                .Must(items => items != null && items.Any()).WithMessage("Danh sách kiểm đếm trống.");

            RuleForEach(x => x.RequestData.ReceivedItems).ChildRules(item =>
            {
                item.RuleFor(i => i.ItemId).NotEmpty().NotEqual(Guid.Empty);
                item.RuleFor(i => i.QuantityReceived).GreaterThanOrEqualTo(0).WithMessage("Số lượng thực nhận không được âm.");
            });
        });
    }
}