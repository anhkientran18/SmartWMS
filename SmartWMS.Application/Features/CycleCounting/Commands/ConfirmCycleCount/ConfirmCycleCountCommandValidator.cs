using FluentValidation;
using Microsoft.Extensions.Localization;
using SmartWMS.Domain.Localization;

namespace SmartWMS.Application.Features.InventoryManagement.Commands.ConfirmCycleCount;

public class ConfirmCycleCountCommandValidator : AbstractValidator<ConfirmCycleCountCommand>
{
    public ConfirmCycleCountCommandValidator(IStringLocalizer<SharedResource> localizer)
    {
        // 1. Kiểm tra vị trí ô kệ thực hiện kiểm kê
        RuleFor(v => v.BinId)
            .NotEmpty()
            .WithMessage(_ => localizer["BinId_Required"]);

        // 2. Kiểm tra mã sản phẩm được đếm thực tế
        RuleFor(v => v.ProductId)
            .NotEmpty()
            .WithMessage(_ => localizer["ProductId_Required"]);

        // 3. RÀNG BUỘC SỐ LƯỢNG THỰC TẾ: Bắt buộc phải lớn hơn hoặc bằng 0
        RuleFor(v => v.PhysicalQuantity)
            .GreaterThanOrEqualTo(0)
            .WithMessage(_ => localizer["PhysicalQuantity_Invalid"]); // Bản dịch đề xuất: "Số lượng kiểm kê thực tế không được là số âm."
    }
}