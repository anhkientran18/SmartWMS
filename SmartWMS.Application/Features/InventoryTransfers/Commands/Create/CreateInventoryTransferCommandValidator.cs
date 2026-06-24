using FluentValidation;
using SmartWMS.Application.Features.InventoryTransfers.Commands.Create;

namespace SmartWMS.Application.Features.InventoryTransfers.Commands;

public class CreateInventoryTransferCommandValidator : AbstractValidator<CreateInventoryTransferCommand>
{
    public CreateInventoryTransferCommandValidator()
    {
        RuleFor(v => v.SKU)
            .NotEmpty().WithMessage("Mã SKU sản phẩm luân chuyển không được để trống.");

        RuleFor(v => v.SourceBinId)
            .NotEmpty().WithMessage("Vui lòng chỉ định ô kệ gốc (Source Bin).");

        RuleFor(v => v.DestinationBinId)
            .NotEmpty().WithMessage("Vui lòng chỉ định ô kệ đích (Destination Bin).")
            // Sử dụng NotEqual để chặn trường hợp kệ gốc trùng kệ đích ngay từ vòng gửi xe
            .NotEqual(v => v.SourceBinId).WithMessage("Kệ gốc và kệ đích không được trùng nhau.");

        RuleFor(v => v.Quantity)
            .GreaterThan(0).WithMessage("Số lượng yêu cầu luân chuyển phải lớn hơn 0.");
    }
}