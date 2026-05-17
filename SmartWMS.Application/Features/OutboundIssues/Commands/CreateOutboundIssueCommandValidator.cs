using FluentValidation;
using Microsoft.Extensions.Localization;
using SmartWMS.Domain.Localization;

namespace SmartWMS.Application.Features.OutboundIssues.Commands;

public class CreateOutboundIssueCommandValidator : AbstractValidator<CreateOutboundIssueCommand>
{
    public CreateOutboundIssueCommandValidator(IStringLocalizer<SharedResource> localizer)
    {
        RuleFor(v => v.SKU)
            .NotEmpty().WithMessage(_ => localizer["SKU_Required"]);

        RuleFor(v => v.Quantity)
            .GreaterThan(0).WithMessage(_ => localizer["Quantity_GreaterThanZero"]);

        RuleFor(v => v.BinId)
            .NotEmpty().WithMessage(_ => localizer["BinId_Required"]);
    }
}