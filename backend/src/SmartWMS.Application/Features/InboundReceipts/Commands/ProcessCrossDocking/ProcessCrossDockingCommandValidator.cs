using FluentValidation;

namespace SmartWMS.Application.Features.InboundReceipts.Commands.ProcessCrossDocking;

public class ProcessCrossDockingCommandValidator : AbstractValidator<ProcessCrossDockingCommand>
{
    public ProcessCrossDockingCommandValidator()
    {
        RuleFor(x => x.RequestData).NotNull();
        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.ProductId).NotEmpty();
            RuleFor(x => x.RequestData.IncomingQuantity).GreaterThan(0);
            RuleFor(x => x.RequestData.SourceDockCode).NotEmpty().MaximumLength(50);
        });
    }
}