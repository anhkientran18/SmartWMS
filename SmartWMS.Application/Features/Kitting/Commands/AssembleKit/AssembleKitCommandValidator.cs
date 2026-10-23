using FluentValidation;
using System;
using System.Linq;

namespace SmartWMS.Application.Features.Kitting.Commands.AssembleKit;

public class AssembleKitCommandValidator : AbstractValidator<AssembleKitCommand>
{
    public AssembleKitCommandValidator()
    {
        RuleFor(x => x.RequestData).NotNull().WithMessage("Dữ liệu không được để trống.");
        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.KitProductId).NotEmpty().NotEqual(Guid.Empty);
            RuleFor(x => x.RequestData.TargetBinId).NotEmpty().NotEqual(Guid.Empty);
            RuleFor(x => x.RequestData.AssembleQuantity).GreaterThan(0).WithMessage("Số lượng lắp ráp phải lớn hơn 0.");

            RuleFor(x => x.RequestData.Components)
                .NotEmpty().WithMessage("Phải có ít nhất 1 sản phẩm thành phần để tạo Combo.")
                .Must(x => x != null && x.Any());

            RuleForEach(x => x.RequestData.Components).NotNull().ChildRules(component =>
            {
                component.RuleFor(x => x.ComponentProductId).NotEmpty();
                component.RuleFor(x => x.SourceBinId).NotEmpty();
                component.RuleFor(x => x.QuantityPerKit).GreaterThan(0);
            });
        });
    }
}
