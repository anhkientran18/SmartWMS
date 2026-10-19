using FluentValidation;
using System;

namespace SmartWMS.Application.Features.InventoryManagement.Commands.ChangeStockStatus;

public class ChangeStockStatusCommandValidator : AbstractValidator<ChangeStockStatusCommand>
{
    public ChangeStockStatusCommandValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu không được trống.");
        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.BinId).NotEmpty().NotEqual(Guid.Empty).WithMessage("Vui lòng chọn ô kệ.");
            RuleFor(x => x.RequestData.ProductId).NotEmpty().NotEqual(Guid.Empty).WithMessage("Vui lòng chọn sản phẩm.");
            RuleFor(x => x.RequestData.ReasonCode).NotEmpty().WithMessage("Vui lòng nhập lý do thay đổi trạng thái (VD: Hàng móp méo, Hết hạn...).");
            RuleFor(x => x.RequestData.NewStatus).IsInEnum().WithMessage("Trạng thái tồn kho không hợp lệ.");
        });
    }
}