using FluentValidation;
using System;
using System.Linq;

namespace SmartWMS.Application.Features.CycleCounting.Commands.ConfirmCycleCount;

public class ConfirmCycleCountCommandValidator : AbstractValidator<ConfirmCycleCountCommand>
{
    public ConfirmCycleCountCommandValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu không được trống.");
        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.CountSheetId).NotEmpty().NotEqual(Guid.Empty).WithMessage("ID phiếu kiểm kê không hợp lệ.");

            RuleFor(x => x.RequestData.CountedItems)
                .NotEmpty().WithMessage("Vui lòng cung cấp kết quả kiểm đếm.")
                .Must(items => items != null && items.Any()).WithMessage("Danh sách kiểm đếm trống.")
                .Must(items => items == null || items.Where(i => i != null).Select(i => i.ItemId).Distinct().Count() == items.Count)
                .WithMessage("Danh sách detail kiểm kê không được trùng lặp hoặc chứa phần tử null.");

            RuleForEach(x => x.RequestData.CountedItems).NotNull().ChildRules(item =>
            {
                item.RuleFor(i => i.ItemId).NotEmpty().NotEqual(Guid.Empty);
                item.RuleFor(i => i.CountedQuantity).NotNull().GreaterThanOrEqualTo(0).WithMessage("Số lượng kiểm đếm không được là số âm.");
            });
        });
    }
}