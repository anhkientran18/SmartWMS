using FluentValidation;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;

namespace SmartWMS.Application.Features.Warehouses.Commands.UpdateWarehouse;

public class UpdateWarehouseCommandValidator : AbstractValidator<UpdateWarehouseCommand>
{
    private readonly IApplicationDbContext _context;

    public UpdateWarehouseCommandValidator(IApplicationDbContext context)
    {
        _context = context;

        // 1. Kiểm tra mã định danh Id của bản ghi cần sửa
        RuleFor(v => v.Id)
            .NotEmpty().WithMessage("Mã định danh (Id) nhà kho không được để trống.");

        // 2. Kiểm tra Mã nhà kho mới
        RuleFor(v => v.Code)
            .NotEmpty().WithMessage("Mã nhà kho không được để trống.")
            .MaximumLength(50).WithMessage("Mã nhà kho không được vượt quá 50 ký tự.")
            .MustAsync(BeUniqueCodeExceptSelf).WithMessage("Mã nhà kho này đã được sử dụng bởi một kho hàng khác.");

        // 3. Kiểm tra Tên nhà kho mới
        RuleFor(v => v.Name)
            .NotEmpty().WithMessage("Tên nhà kho không được để trống.")
            .MaximumLength(150).WithMessage("Tên nhà kho không được vượt quá 150 ký tự.");

        // 4. Kiểm tra Địa chỉ nhà kho mới
        RuleFor(v => v.Address)
            .NotEmpty().WithMessage("Địa chỉ nhà kho không được để trống.")
            .MaximumLength(250).WithMessage("Địa chỉ nhà kho không được vượt quá 250 ký tự.");
    }

    private async Task<bool> BeUniqueCodeExceptSelf(UpdateWarehouseCommand command, string code, CancellationToken cancellationToken)
    {
        // Cho phép lưu nếu trùng với chính nó, nhưng chặn nếu trùng với bản ghi Id khác
        return await _context.Warehouses
            .AllAsync(w => w.Id == command.Id || w.Code.ToLower() != code.ToLower(), cancellationToken);
    }
}