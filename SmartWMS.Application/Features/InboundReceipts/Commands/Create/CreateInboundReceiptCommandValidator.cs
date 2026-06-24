using FluentValidation;
using Microsoft.Extensions.Localization;
using SmartWMS.Domain.Localization; // Namespace chứa SharedResource của hệ thống

namespace SmartWMS.Application.Features.InboundReceipts.Commands.Create;

public class CreateInboundReceiptCommandValidator : AbstractValidator<CreateInboundReceiptCommand>
{
    public CreateInboundReceiptCommandValidator(IStringLocalizer<SharedResource> localizer)
    {
        // 1. Ràng buộc mã SKU sản phẩm nhập kho
        RuleFor(v => v.SKU)
            .NotEmpty()
            .WithMessage(_ => localizer["SKU_Required"]); // Bản dịch: "Mã SKU sản phẩm không được để trống"

        // 2. Ràng buộc số lượng hàng hóa phải là số dương lớn hơn 0
        RuleFor(v => v.Quantity)
            .GreaterThan(0)
            .WithMessage(_ => localizer["Quantity_GreaterThanZero"]); // Bản dịch: "Số lượng hàng hóa nhập kho phải lớn hơn 0"

        // 3. Ràng buộc ô kệ đích chỉ định cất hàng
        RuleFor(v => v.BinId)
            .NotEmpty()
            .WithMessage(_ => localizer["BinId_Required"]); // Bản dịch: "Vị trí ô kệ đích không được để trống"
    }
}