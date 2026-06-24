using FluentValidation;
using Microsoft.Extensions.Localization;
using SmartWMS.Domain.Localization;
using System;

namespace SmartWMS.Application.Features.InboundReceipts.Commands.ConfirmInboundReceipt;

public class ConfirmInboundReceiptCommandValidator : AbstractValidator<ConfirmInboundReceiptCommand>
{
    public ConfirmInboundReceiptCommandValidator(IStringLocalizer<SharedResource> localizer)
    {
        // 1. Kiểm tra ô kệ đích được chỉ định để hạ hàng xuống
        RuleFor(v => v.BinId)
            .NotEmpty()
            .WithMessage(_ => localizer["BinId_Required"]);

        // 2. Kiểm tra mã sản phẩm thực hiện nhập kho
        RuleFor(v => v.ProductId)
            .NotEmpty()
            .WithMessage(_ => localizer["ProductId_Required"]);

        // 3. Kiểm tra số lô hàng (Lot Number) phục vụ truy xuất nguồn gốc chặng sau
        RuleFor(v => v.LotNumber)
            .NotEmpty()
            .WithMessage(_ => localizer["LotNumber_Required"]) // Bản dịch đề xuất: "Mã số lô hàng nhập kho không được để trống."
            .MaximumLength(50)
            .WithMessage(_ => localizer["LotNumber_TooLong"]);

        // 4. RÀNG BUỘC SỐ LƯỢNG NHẬP: Bắt buộc phải lớn hơn 0
        RuleFor(v => v.Quantity)
            .GreaterThan(0)
            .WithMessage(_ => localizer["Quantity_GreaterThanZero"]); // Bản dịch đề xuất: "Số lượng hàng hóa xác nhận nhập kho phải lớn hơn 0."

        // 5. RÀNG BUỘC NGÀY HẾT HẠN (Nếu có): Hàng nhập kho mới bắt buộc ngày hết hạn phải nằm ở tương lai
        RuleFor(v => v.ExpirationDate)
            .Must(date => !date.HasValue || date.Value.Date > DateTime.Today)
            .WithMessage(_ => localizer["ExpirationDate_MustBeInFuture"]); // Bản dịch đề xuất: "Hạn sử dụng của lô hàng nhập không được nằm ở quá khứ hoặc ngày hiện tại."
    }
}