using FluentValidation;
using Microsoft.Extensions.Localization;
using SmartWMS.Domain.Localization;

namespace SmartWMS.Application.Features.Kitting.Commands.AssembleKit;

public class AssembleKitCommandValidator : AbstractValidator<AssembleKitCommand>
{
    public AssembleKitCommandValidator(IStringLocalizer<SharedResource> localizer)
    {
        // 1. Kiểm tra mã sản phẩm Combo/Kit đích không được rỗng
        RuleFor(v => v.ComboProductId)
            .NotEmpty()
            .WithMessage(_ => localizer["ComboProductId_Required"]);

        // 2. Kiểm tra số lượng thành phẩm Combo muốn đóng gói bắt buộc phải lớn hơn 0
        RuleFor(v => v.QuantityToBuild)
            .GreaterThan(0)
            .WithMessage(_ => localizer["QuantityToBuild_GreaterThanZero"]); // Bản dịch đề xuất: "Số lượng bộ Combo cần lắp ráp phải lớn hơn 0."

        // 3. Kiểm tra danh sách linh kiện đầu vào không được để trống
        RuleFor(v => v.Components)
            .NotEmpty()
            .WithMessage(_ => localizer["Components_Required"])
            .Must(c => c != null && c.Count > 0)
            .WithMessage(_ => localizer["Components_MustContainItems"]); // Bản dịch đề xuất: "Danh sách linh kiện cấu thành bộ Combo không được rỗng."

        // 4. 🌟 VÒNG LẶP KIỂM TRA TỪNG LINH KIỆN (Collection Validation)
        // Khóa chặt dữ liệu của từng item bên trong List<KitComponentDto>
        RuleForEach(v => v.Components).ChildRules(component =>
        {
            // Kiểm tra mã linh kiện thành phần
            component.RuleFor(c => c.ProductId)
                .NotEmpty()
                .WithMessage(_ => localizer["ComponentProductId_Required"]);

            // Kiểm tra định mức số lượng linh kiện cho 1 bộ Combo
            component.RuleFor(c => c.QuantityPerKit)
                .GreaterThan(0)
                .WithMessage(_ => localizer["QuantityPerKit_GreaterThanZero"]); // Bản dịch đề xuất: "Số lượng thành phần cấu thành trên mỗi bộ Kit phải lớn hơn 0."
        });
    }
}