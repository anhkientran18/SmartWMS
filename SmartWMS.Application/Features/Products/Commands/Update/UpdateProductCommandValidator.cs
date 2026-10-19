using FluentValidation;

namespace SmartWMS.Application.Features.Products.Commands.Update;

public class UpdateProductCommandValidator : AbstractValidator<UpdateProductCommand>
{
    public UpdateProductCommandValidator()
    {
        RuleFor(x => x.RequestData)
            .NotNull().WithMessage("Dữ liệu đầu vào không được để trống.");

        When(x => x.RequestData != null, () =>
        {
            RuleFor(v => v.RequestData.Id)
                .NotEmpty().WithMessage("Mã định danh (Id) sản phẩm không được trống.");

            RuleFor(v => v.RequestData.Name)
                .NotEmpty().WithMessage("Tên sản phẩm không được để trống.");

            RuleFor(v => v.RequestData.SKU)
                .NotEmpty().WithMessage("Mã SKU không được để trống.");
        });
    }
}