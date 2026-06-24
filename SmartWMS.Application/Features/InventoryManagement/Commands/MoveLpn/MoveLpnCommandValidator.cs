using FluentValidation;
using Microsoft.Extensions.Localization;
using SmartWMS.Domain.Localization;

namespace SmartWMS.Application.Features.InventoryManagement.Commands.MoveLpn;

public class MoveLpnCommandValidator : AbstractValidator<MoveLpnCommand>
{
    public MoveLpnCommandValidator(IStringLocalizer<SharedResource> localizer)
    {
        // 1. Kiểm tra mã Pallet / Kiện hàng tổng
        RuleFor(v => v.LpnCode)
            .NotEmpty()
            .WithMessage(_ => localizer["LpnCode_Required"]) // Bản dịch đề xuất: "Mã kiện hàng hoặc mã Pallet không được để trống."
            .MaximumLength(50)
            .WithMessage(_ => localizer["LpnCode_TooLong"]);

        // 2. Kiểm tra mã định danh ô kệ đích đến (Chặn đứng Guid.Empty)
        RuleFor(v => v.ToBinId)
            .NotEmpty()
            .WithMessage(_ => localizer["DestinationBinId_Required"]); // Bản dịch đề xuất: "Vui lòng chọn vị trí ô kệ đích để hạ kiện hàng xuống."
    }
}