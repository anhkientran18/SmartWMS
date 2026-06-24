using FluentValidation;
using Microsoft.Extensions.Localization;
using SmartWMS.Domain.Localization;

namespace SmartWMS.Application.Features.InventoryManagement.Commands.ProcessDamageQuarantine;

public class ProcessDamageQuarantineCommandValidator : AbstractValidator<ProcessDamageQuarantineCommand>
{
    public ProcessDamageQuarantineCommandValidator(IStringLocalizer<SharedResource> localizer)
    {
        // 1. Kiểm tra ID ô kệ phát hiện lỗi
        RuleFor(v => v.BinId)
            .NotEmpty()
            .WithMessage(_ => localizer["BinId_Required"]);

        // 2. Kiểm tra ID sản phẩm bị hỏng
        RuleFor(v => v.ProductId)
            .NotEmpty()
            .WithMessage(_ => localizer["ProductId_Required"]);

        // 3. Kiểm tra số lô hàng (Batch/Lot Number) để khoanh vùng cách ly chính xác
        RuleFor(v => v.BatchNumber)
            .NotEmpty()
            .WithMessage(_ => localizer["BatchNumber_Required"])
            .MaximumLength(50)
            .WithMessage(_ => localizer["BatchNumber_TooLong"]);

        // 4. RÀNG BUỘC SỐ LƯỢNG CÁCH LY: Bắt buộc phải lớn hơn 0
        RuleFor(v => v.QuarantineQuantity)
            .GreaterThan(0)
            .WithMessage(_ => localizer["QuarantineQuantity_GreaterThanZero"]); // Bản dịch đề xuất: "Số lượng sản phẩm lỗi đưa vào vùng cách ly phải lớn hơn 0."

        // 5. Kiểm tra lý do hỏng (Chặn chuỗi rỗng hoặc quá dài làm phình DB)
        RuleFor(v => v.DamageReason)
            .NotEmpty()
            .WithMessage(_ => localizer["DamageReason_Required"])
            .MaximumLength(250)
            .WithMessage(_ => localizer["DamageReason_TooLong"]);
    }
}