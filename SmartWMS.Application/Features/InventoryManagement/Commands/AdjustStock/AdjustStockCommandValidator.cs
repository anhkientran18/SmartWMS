using FluentValidation;
using Microsoft.Extensions.Localization;
using SmartWMS.Domain.Localization;

namespace SmartWMS.Application.Features.InventoryManagement.Commands.AdjustStock;

public class AdjustStockCommandValidator : AbstractValidator<AdjustStockCommand>
{
    public AdjustStockCommandValidator(IStringLocalizer<SharedResource> localizer)
    {
        RuleFor(v => v.ProductId)
            .NotEmpty()
            .WithMessage(_ => localizer["ProductId_Required"]);

        RuleFor(v => v.BinId)
            .NotEmpty()
            .WithMessage(_ => localizer["BinId_Required"]);

        // Số lượng điều chỉnh có thể âm hoặc dương, nhưng không được bằng 0
        RuleFor(v => v.Quantity)
            .NotEqual(0)
            .WithMessage(_ => localizer["AdjustQuantity_MustNotBeZero"]);

        // Bắt buộc nhập lý do điều chỉnh để phục vụ công tác tra cứu nhật ký hệ thống
        RuleFor(v => v.Reason)
            .NotEmpty()
            .WithMessage(_ => localizer["Reason_Required"])
            .MaximumLength(250)
            .WithMessage(_ => localizer["Reason_TooLong"]);
    }
}