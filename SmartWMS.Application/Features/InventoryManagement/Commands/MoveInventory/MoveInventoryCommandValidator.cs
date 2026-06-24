using FluentValidation;
using Microsoft.Extensions.Localization;
using SmartWMS.Domain.Localization;

namespace SmartWMS.Application.Features.InventoryManagement.Commands.MoveInventory;

public class MoveInventoryCommandValidator : AbstractValidator<MoveInventoryCommand>
{
    public MoveInventoryCommandValidator(IStringLocalizer<SharedResource> localizer)
    {
        RuleFor(v => v.FromBinId)
            .NotEmpty()
            .WithMessage(_ => localizer["FromBinId_Required"]);

        // 🌟 BẢO VỆ: Chặn đứng trường hợp chọn kệ đích trùng khít với kệ nguồn
        RuleFor(v => v.ToBinId)
            .NotEmpty()
            .WithMessage(_ => localizer["ToBinId_Required"])
            .NotEqual(v => v.FromBinId)
            .WithMessage(_ => localizer["SourceAndDestinationBin_MustNotBeSame"]); // Bản dịch đề xuất: "Ô kệ nguồn và ô kệ đích không được phép trùng nhau."

        RuleFor(v => v.ProductId)
            .NotEmpty()
            .WithMessage(_ => localizer["ProductId_Required"]);

        // 🌟 BẢO VỆ: Số lượng dịch chuyển bắt buộc phải lớn hơn 0
        RuleFor(v => v.MoveQuantity)
            .GreaterThan(0)
            .WithMessage(_ => localizer["MoveQuantity_GreaterThanZero"]);
    }
}