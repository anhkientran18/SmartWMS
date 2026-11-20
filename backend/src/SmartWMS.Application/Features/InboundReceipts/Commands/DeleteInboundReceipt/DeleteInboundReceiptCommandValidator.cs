using FluentValidation;
using System;

namespace SmartWMS.Application.Features.InboundReceipts.Commands.DeleteInboundReceipt;

public class DeleteInboundReceiptCommandValidator : AbstractValidator<DeleteInboundReceiptCommand>
{
    public DeleteInboundReceiptCommandValidator()
    {
        RuleFor(x => x.RequestData).NotNull();
        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.Id).NotEmpty().NotEqual(Guid.Empty).WithMessage("Mã phiếu nhập không hợp lệ.");
        });
    }
}