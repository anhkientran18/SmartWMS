using FluentValidation;
using System;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.CreatePickTask;

public class CreatePickTaskCommandValidator : AbstractValidator<CreatePickTaskCommand>
{
    public CreatePickTaskCommandValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu không được trống.");
        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.OutboundOrderId)
                .NotEmpty().WithMessage("Vui lòng cung cấp ID đơn hàng xuất.")
                .NotEqual(Guid.Empty);
        });
    }
}