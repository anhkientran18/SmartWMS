using FluentValidation;
using System;
using System.Linq;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.CreateOutboundOrder;

public sealed class CreateOutboundOrderCommandValidator : AbstractValidator<CreateOutboundOrderCommand>
{
    public CreateOutboundOrderCommandValidator()
    {
        RuleFor(x => x.RequestData)
            .NotNull()
            .WithMessage("Dữ liệu tạo phiếu xuất không được để trống.");

        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.BinId).NotEmpty().WithMessage("Vui lòng chọn ô kệ xuất hàng.");

            RuleFor(v => v.RequestData.OrderNumber)
                .NotEmpty().WithMessage("Mã đơn hàng xuất không được để trống.")
                .MaximumLength(50).WithMessage("Mã đơn hàng xuất không vượt quá 50 ký tự.");

            RuleFor(v => v.RequestData.ExpectedShipDate)
                .GreaterThanOrEqualTo(DateTime.UtcNow.Date)
                .WithMessage("Ngày dự kiến xuất hàng không được nằm trong quá khứ.");

            RuleFor(v => v.RequestData.Items)
                .NotEmpty().WithMessage("Phiếu xuất phải có ít nhất 1 mặt hàng.")
                .Must(items => items != null && items.Any()).WithMessage("Danh sách mặt hàng xuất không được trống.");

            // Validate chi tiết từng Line Item bên trong danh sách
            RuleForEach(v => v.RequestData.Items).ChildRules(items =>
            {
                items.RuleFor(i => i.ProductId)
                    .NotEmpty().NotEqual(Guid.Empty).WithMessage("Mã sản phẩm không hợp lệ.");

                items.RuleFor(i => i.RequestedQuantity)
                    .GreaterThan(0).WithMessage("Số lượng yêu cầu xuất phải lớn hơn 0.");
            });
        });
    }
}