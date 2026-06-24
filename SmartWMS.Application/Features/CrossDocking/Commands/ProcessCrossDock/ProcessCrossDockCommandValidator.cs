using FluentValidation;
using Microsoft.Extensions.Localization;
using SmartWMS.Domain.Localization;

namespace SmartWMS.Application.Features.CrossDocking.Commands.ProcessCrossDock;

public class ProcessCrossDockCommandValidator : AbstractValidator<ProcessCrossDockCommand>
{
    public ProcessCrossDockCommandValidator(IStringLocalizer<SharedResource> localizer)
    {
        // 1. Kiểm tra ID sản phẩm hạ tải
        RuleFor(v => v.ProductId)
            .NotEmpty()
            .WithMessage(_ => localizer["ProductId_Required"]);

        // 2. RÀNG BUỘC SỐ LƯỢNG HẠ TẢI: Bắt buộc phải lớn hơn 0
        RuleFor(v => v.IncomingQuantity)
            .GreaterThan(0)
            .WithMessage(_ => localizer["IncomingQuantity_GreaterThanZero"]); // Bản dịch đề xuất: "Số lượng hàng hóa hạ tải để làm Cross-Dock phải lớn hơn 0."

        // 3. Kiểm tra mã bến nhận hàng đầu vào
        RuleFor(v => v.SourceDockCode)
            .NotEmpty()
            .WithMessage(_ => localizer["SourceDockCode_Required"])
            .MaximumLength(50)
            .WithMessage(_ => localizer["SourceDockCode_TooLong"]);
    }
}