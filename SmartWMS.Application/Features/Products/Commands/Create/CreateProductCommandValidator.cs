using FluentValidation;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;

namespace SmartWMS.Application.Features.Products.Commands.Create;

public class CreateProductCommandValidator : AbstractValidator<CreateProductCommand>
{
    private readonly IApplicationDbContext _context;

    public CreateProductCommandValidator(IApplicationDbContext context)
    {
        _context = context;

        RuleFor(v => v.Name)
            .NotEmpty().WithMessage("Tên sản phẩm không được để trống.")
            .MaximumLength(200).WithMessage("Tên sản phẩm không được vượt quá 200 ký tự.");

        RuleFor(v => v.SKU)
            .NotEmpty().WithMessage("Mã SKU không được để trống.")
            .MaximumLength(50).WithMessage("Mã SKU không được vượt quá 50 ký tự.")
            .MustAsync(BeUniqueSKU).WithMessage("Mã SKU này đã tồn tại trên hệ thống.");
    }

    private async Task<bool> BeUniqueSKU(string sku, CancellationToken cancellationToken)
    {
        // Chặn trùng SKU toàn hệ thống (không phân biệt chữ hoa/chữ thường)
        return await _context.Products
            .AllAsync(p => p.SKU.ToLower() != sku.ToLower(), cancellationToken);
    }
}