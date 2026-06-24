using FluentValidation;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;

namespace SmartWMS.Application.Features.Warehouses.Commands.CreateWarehouse;

public class CreateWarehouseCommandValidator : AbstractValidator<CreateWarehouseCommand>
{
    private readonly IApplicationDbContext _context;

    public CreateWarehouseCommandValidator(IApplicationDbContext context)
    {
        _context = context;

        // 1. Kiểm tra Mã nhà kho (Code)
        RuleFor(v => v.Code)
            .NotEmpty().WithMessage("Mã nhà kho không được để trống.")
            .MaximumLength(50).WithMessage("Mã nhà kho không được vượt quá 50 ký tự.")
            .MustAsync(BeUniqueCode).WithMessage("Mã nhà kho này đã tồn tại trên hệ thống WMS.");

        // 2. Kiểm tra Tên nhà kho (Name)
        RuleFor(v => v.Name)
            .NotEmpty().WithMessage("Tên nhà kho không được để trống.")
            .MaximumLength(150).WithMessage("Tên nhà kho không được vượt quá 150 ký tự.");

        // 3. Kiểm tra Địa chỉ nhà kho (Address)
        RuleFor(v => v.Address)
            .NotEmpty().WithMessage("Địa chỉ nhà kho không được để trống.")
            .MaximumLength(250).WithMessage("Địa chỉ nhà kho không được vượt quá 250 ký tự.");
    }

    private async Task<bool> BeUniqueCode(string code, CancellationToken cancellationToken)
    {
        // Kiểm tra không cho phép trùng Mã kho (Không phân biệt chữ hoa/chữ thường)
        return await _context.Warehouses
            .AllAsync(w => w.Code.ToLower() != code.ToLower(), cancellationToken);
    }
}