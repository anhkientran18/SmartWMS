using FluentValidation;
using Microsoft.Extensions.Localization;
using SmartWMS.Domain.Localization;

namespace SmartWMS.Application.Features.InventoryManagement.Commands.ChangeStockStatus;

public class ChangeStockStatusCommandValidator : AbstractValidator<ChangeStockStatusCommand>
{
    public ChangeStockStatusCommandValidator(IStringLocalizer<SharedResource> localizer)
    {
        // 1. Kiểm tra vị trí ô kệ chứa hàng hóa cần chuyển trạng thái
        RuleFor(v => v.BinId)
            .NotEmpty()
            .WithMessage(_ => localizer["BinId_Required"]);

        // 2. Kiểm tra mã sản phẩm đích danh
        RuleFor(v => v.ProductId)
            .NotEmpty()
            .WithMessage(_ => localizer["ProductId_Required"]);

        // 3. RÀNG BUỘC ĐỊNH MỨC TRẠNG THÁI: Chỉ chấp nhận các giá trị từ 1 đến 4
        // (1 - Available, 2 - Quarantine, 3 - Blocked, 4 - Damaged)
        RuleFor(v => v.NewStatus)
            .InclusiveBetween(1, 4)
            .WithMessage(_ => localizer["StockStatus_Invalid"]); // Bản dịch đề xuất: "Trạng thái tồn kho mới không hợp lệ, vui lòng chọn từ 1 đến 4."

        // 4. BẮT BUỘC: Đổi trạng thái tồn kho hiện trường bắt buộc phải ghi rõ lý do lý trấu
        RuleFor(v => v.Reason)
            .NotEmpty()
            .WithMessage(_ => localizer["Reason_Required"]) // Bản dịch đề xuất: "Lý do thay đổi trạng thái tồn kho không được để trống."
            .MaximumLength(250)
            .WithMessage(_ => localizer["Reason_TooLong"]);
    }
}