using FluentValidation;

namespace SmartWMS.Application.Features.Products.Commands.Delete;

public class DeleteProductCommandValidator : AbstractValidator<DeleteProductCommand>
{
    public DeleteProductCommandValidator()
    {
        RuleFor(x => x.RequestData)
            .NotNull().WithMessage("Dữ liệu đầu vào không được để trống.");

        When(x => x.RequestData != null, () =>
        {
            RuleFor(x => x.RequestData.Id)
                .NotEmpty().WithMessage("Vui lòng cung cấp mã định danh (Id) sản phẩm cần xóa.");
        });
    }
}