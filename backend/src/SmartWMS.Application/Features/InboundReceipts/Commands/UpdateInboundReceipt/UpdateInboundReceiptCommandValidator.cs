using FluentValidation;

namespace SmartWMS.Application.Features.InboundReceipts.Commands.UpdateInboundReceipt;

public class UpdateInboundReceiptCommandValidator : AbstractValidator<UpdateInboundReceiptCommand>
{
    public UpdateInboundReceiptCommandValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu cập nhật không được để trống.");
        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.BinId).NotEmpty()
                .When(x => x.RequestData.BinId.HasValue)
                .WithMessage("Mã ô kệ đích không hợp lệ.");

            RuleFor(x => x.RequestData.Id)
                .NotEmpty().WithMessage("Mã định danh phiếu nhập không được để trống.");

            RuleFor(x => x.RequestData.Items)
                .NotEmpty().WithMessage("Danh sách mặt hàng nhập kho không được để trống.");

            RuleForEach(x => x.RequestData.Items).ChildRules(items =>
            {
                items.RuleFor(i => i.ProductId)
                    .NotEmpty().WithMessage("Mã sản phẩm không được để trống.");
                items.RuleFor(i => i.ExpectedQuantity)
                    .GreaterThan(0).WithMessage("Số lượng dự kiến nhập phải lớn hơn 0.");
            });
        });
    }
}