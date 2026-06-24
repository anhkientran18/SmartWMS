using FluentValidation;
using System;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.CreatePickTask;

public class CreatePickTaskCommandValidator : AbstractValidator<CreatePickTaskCommand>
{
    public CreatePickTaskCommandValidator()
    {
        RuleFor(x => x.ProductId)
            .NotEmpty().WithMessage("Mã ID định danh sản phẩm bốc kho không được để trống.");

        RuleFor(x => x.RequestedQuantity)
            .GreaterThan(0).WithMessage("Số lượng yêu cầu xuất kho phải lớn hơn 0 sản phẩm.");
    }
}