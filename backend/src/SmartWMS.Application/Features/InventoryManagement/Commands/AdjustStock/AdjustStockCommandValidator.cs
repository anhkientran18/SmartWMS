using FluentValidation;
using System;

namespace SmartWMS.Application.Features.InventoryManagement.Commands.AdjustStock;

public class AdjustStockCommandValidator : AbstractValidator<AdjustStockCommand>
{
    public AdjustStockCommandValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu không được trống.");
        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.BinId).NotEmpty().NotEqual(Guid.Empty).WithMessage("Vui lòng chọn ô kệ.");
            RuleFor(x => x.RequestData.ProductId).NotEmpty().NotEqual(Guid.Empty).WithMessage("Vui lòng chọn sản phẩm.");
            RuleFor(x => x.RequestData.AdjustmentQuantity).NotEqual(0).WithMessage("Số lượng điều chỉnh phải khác 0.");
            RuleFor(x => x.RequestData.ReasonCode).NotEmpty().WithMessage("Vui lòng nhập lý do điều chỉnh.");
        });
    }
}