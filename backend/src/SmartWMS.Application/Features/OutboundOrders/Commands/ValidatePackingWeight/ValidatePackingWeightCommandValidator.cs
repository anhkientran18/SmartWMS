using FluentValidation;
using System;
using Microsoft.Extensions.Localization;
using SmartWMS.Domain.Localization;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.ValidatePackingWeight;

public class ValidatePackingWeightCommandValidator : AbstractValidator<ValidatePackingWeightCommand>
{
    public ValidatePackingWeightCommandValidator(IStringLocalizer<SharedResource> localizer)
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu không được để trống.");
        When(x => x.RequestData != null, () =>
        {
            RuleFor(v => v.RequestData.OrderId)
                .NotEmpty()
                .WithMessage(_ => localizer["OrderId_Required"]);

            RuleFor(v => v.RequestData.SKU).NotEmpty();
            RuleFor(v => v.RequestData.Quantity).GreaterThan(0);

            RuleFor(v => v.RequestData.ActualWeightGrams)
                .GreaterThan(0).Must(double.IsFinite)
                .WithMessage(_ => localizer["Weight_GreaterThanZero"]);
        });
    }
}