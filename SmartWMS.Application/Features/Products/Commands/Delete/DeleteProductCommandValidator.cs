using FluentValidation;

namespace SmartWMS.Application.Features.Products.Commands.Delete;

public class DeleteProductCommandValidator : AbstractValidator<DeleteProductCommand>
{
    public DeleteProductCommandValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("Vui lòng cung cấp mã định danh (Id) sản phẩm cần xóa.");
    }
}