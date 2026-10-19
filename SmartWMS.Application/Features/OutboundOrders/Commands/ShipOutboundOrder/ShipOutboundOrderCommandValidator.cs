using FluentValidation;
using System;
using System.Linq;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.ShipOutboundOrder;

public class ShipOutboundOrderCommandValidator : AbstractValidator<ShipOutboundOrderCommand>
{
    public ShipOutboundOrderCommandValidator()
    {
        RuleFor(x => x.OrderId).NotEmpty();
        RuleFor(x => x.RequestData).NotNull();
        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.PackingChecks).NotEmpty()
                .Must(x => x == null || x.Where(c => c != null).Select(c => c.SKU).Distinct(StringComparer.Ordinal).Count() == x.Count)
                .WithMessage("Mỗi SKU phải có đúng một kết quả cân.");
            RuleForEach(x => x.RequestData.PackingChecks).NotNull().ChildRules(c =>
            {
                c.RuleFor(x => x.SKU).NotEmpty();
                c.RuleFor(x => x.Quantity).GreaterThan(0);
                c.RuleFor(x => x.ActualWeightGrams).GreaterThan(0).Must(double.IsFinite);
            });
        });
    }
}
