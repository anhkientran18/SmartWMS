using FluentValidation;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;

namespace SmartWMS.Application.Features.Products.Commands.Update;

public class UpdateProductCommandValidator : AbstractValidator<UpdateProductCommand>
{
    private readonly IApplicationDbContext _context;

    public UpdateProductCommandValidator(IApplicationDbContext context)
    {
        _context = context;

        RuleFor(v => v.Id)
            .NotEmpty().WithMessage("Mã định danh (Id) sản phẩm không được trống.");

        RuleFor(v => v.Name)
            .NotEmpty().WithMessage("Tên sản phẩm không được để trống.");

        RuleFor(v => v.SKU)
            .NotEmpty().WithMessage("Mã SKU không được để trống.")
            .MustAsync(BeUniqueSKUExceptSelf).WithMessage("Mã SKU này đã được sử dụng bởi một sản phẩm khác.");
    }

    private async Task<bool> BeUniqueSKUExceptSelf(UpdateProductCommand command, string sku, CancellationToken cancellationToken)
    {
        // Cho phép nếu SKU thuộc về chính bản ghi đang sửa (Id trùng nhau), chặn nếu trùng với bản ghi Id khác
        return await _context.Products
            .AllAsync(p => p.Id == command.Id || p.SKU.ToLower() != sku.ToLower(), cancellationToken);
    }
}