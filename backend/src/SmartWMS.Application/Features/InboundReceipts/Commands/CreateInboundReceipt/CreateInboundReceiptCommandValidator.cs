using FluentValidation;
using System;
using System.Linq;

namespace SmartWMS.Application.Features.InboundReceipts.Commands.CreateInboundReceipt;

public class CreateInboundReceiptCommandValidator : AbstractValidator<CreateInboundReceiptCommand>
{
    public CreateInboundReceiptCommandValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu tạo phiếu nhập không được trống.");

        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.BinId).NotEmpty().WithMessage("Vui lòng chọn ô kệ đích.");

            RuleFor(v => v.RequestData.ReceiptNumber)
                .NotEmpty().WithMessage("Số phiếu nhập (ReceiptNumber) bắt buộc phải có.")
                .MaximumLength(50).WithMessage("Số phiếu nhập không vượt quá 50 ký tự.");

            RuleFor(v => v.RequestData.SupplierId)
                .NotEmpty().WithMessage("Vui lòng chọn Nhà cung cấp (Supplier).");

            RuleFor(v => v.RequestData.ExpectedDeliveryDate)
                .GreaterThanOrEqualTo(DateTime.UtcNow.Date)
                .WithMessage("Ngày dự kiến giao hàng không được nằm trong quá khứ.");

            RuleFor(v => v.RequestData.Items)
                .NotEmpty().WithMessage("Phiếu nhập phải có ít nhất 1 mặt hàng.")
                .Must(items => items != null && items.Any()).WithMessage("Danh sách mặt hàng trống.");

            // Validate từng Line Item bên trong danh sách
            RuleForEach(v => v.RequestData.Items).ChildRules(items =>
            {
                items.RuleFor(i => i.ProductId).NotEmpty().WithMessage("Mã sản phẩm không hợp lệ.");
                items.RuleFor(i => i.ExpectedQuantity).GreaterThan(0).WithMessage("Số lượng nhập dự kiến phải lớn hơn 0.");
            });
        });
    }
}