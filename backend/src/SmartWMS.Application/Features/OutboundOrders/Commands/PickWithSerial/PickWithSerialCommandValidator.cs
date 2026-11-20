using FluentValidation;
using System;
using System.Linq;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.PickWithSerial;

public class PickWithSerialCommandValidator : AbstractValidator<PickWithSerialCommand>
{
    public PickWithSerialCommandValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu không được để trống.");
        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.OrderId).NotEmpty();
            RuleFor(x => x.RequestData.ProductId).NotEmpty();
            RuleFor(x => x.RequestData.BinId).NotEmpty();
            RuleFor(x => x.RequestData.ScannedSerials).NotEmpty()
                .Must(x => x == null || x.Distinct(StringComparer.Ordinal).Count() == x.Count)
                .WithMessage("Danh sách serial không được trùng lặp.");
            RuleForEach(x => x.RequestData.ScannedSerials).NotEmpty().MaximumLength(50);
        });
    }
}
