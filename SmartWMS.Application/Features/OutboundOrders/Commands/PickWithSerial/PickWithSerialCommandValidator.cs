using FluentValidation;
using Microsoft.Extensions.Localization;
using SmartWMS.Domain.Localization;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.PickWithSerial;

public class PickWithSerialCommandValidator : AbstractValidator<PickWithSerialCommand>
{
    public PickWithSerialCommandValidator(IStringLocalizer<SharedResource> localizer)
    {
        // 1. Kiểm tra ID sản phẩm bắt buộc phải có thông tin
        RuleFor(v => v.ProductId)
            .NotEmpty()
            .WithMessage(_ => localizer["ProductId_Required"]);

        // 2. Kiểm tra vị trí ô kệ thực hiện thao tác quét bốc hàng
        RuleFor(v => v.BinId)
            .NotEmpty()
            .WithMessage(_ => localizer["BinId_Required"]);

        // 3. Kiểm tra tính hợp lệ của chuỗi ký tự mã Serial
        RuleFor(v => v.SerialNumber)
            .NotEmpty()
            .WithMessage(_ => localizer["SerialNumber_Required"]) // Bản dịch: "Số định danh Serial của sản phẩm không được để trống"
            .MaximumLength(50)
            .WithMessage(_ => localizer["SerialNumber_TooLong"]); // Bản dịch: "Mã Serial sản phẩm không được vượt quá 50 ký tự"
    }
}