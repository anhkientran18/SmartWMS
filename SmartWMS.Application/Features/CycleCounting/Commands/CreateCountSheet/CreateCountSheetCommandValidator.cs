using FluentValidation;
using Microsoft.Extensions.Localization;
using SmartWMS.Domain.Localization;

namespace SmartWMS.Application.Features.InventoryManagement.Commands.CreateCountSheet;

public class CreateCountSheetCommandValidator : AbstractValidator<CreateCountSheetCommand>
{
    public CreateCountSheetCommandValidator(IStringLocalizer<SharedResource> localizer)
    {
        // 1. Kiểm tra tiêu đề của phiếu kiểm kê
        RuleFor(v => v.Title)
            .NotEmpty()
            .WithMessage(_ => localizer["CountSheetTitle_Required"]) // Bản dịch đề xuất: "Tiêu đề phiếu kiểm kê không được để trống."
            .MaximumLength(150)
            .WithMessage(_ => localizer["CountSheetTitle_TooLong"]);

        // 2. Kiểm tra nhân viên được chỉ định thực hiện đếm hàng tại hiện trường
        RuleFor(v => v.AssignedOperator)
            .NotEmpty()
            .WithMessage(_ => localizer["AssignedOperator_Required"]); // Bản dịch đề xuất: "Vui lòng chỉ định nhân viên chịu trách nhiệm kiểm đếm."

        // 3. Kiểm tra danh sách các ô kệ mục tiêu
        RuleFor(v => v.TargetBinIds)
            .NotEmpty()
            .WithMessage(_ => localizer["TargetBinIds_Required"])
            .Must(ids => ids != null && ids.Count > 0)
            .WithMessage(_ => localizer["TargetBinIds_MustContainItems"]); // Bản dịch đề xuất: "Danh sách ô kệ cần rà soát phải chứa ít nhất một vị trí."
    }
}