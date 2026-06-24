using FluentValidation;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Features.Zones.Commands;

namespace SmartWMS.Application.Features.Zones.Commands.CreateZone;

public class CreateZoneCommandValidator : AbstractValidator<CreateZoneCommand>
{
    private readonly IApplicationDbContext _context;

    public CreateZoneCommandValidator(IApplicationDbContext context)
    {
        _context = context;

        // 1. Kiểm tra Tên khu vực (Zone Name)
        RuleFor(v => v.Name)
            .NotEmpty().WithMessage("Tên khu vực (Zone) không được để trống.")
            .MaximumLength(100).WithMessage("Tên khu vực không được vượt quá 100 ký tự.")
            .MustAsync(BeUniqueName).WithMessage("Tên khu vực này đã tồn tại trong nhà kho được chọn.");

        // 2. Kiểm tra mã định danh Nhà kho quản lý (WarehouseId)
        RuleFor(v => v.WarehouseId)
            .NotEmpty().WithMessage("Vui lòng chỉ định Nhà kho (Warehouse) quản lý khu vực này.");
    }

    private async Task<bool> BeUniqueName(CreateZoneCommand command, string name, CancellationToken cancellationToken)
    {
        // Kiểm tra không cho phép trùng tên Zone trong cùng một WarehouseId (Không phân biệt hoa thường)
        return await _context.Zones
            .AllAsync(z => z.WarehouseId != command.WarehouseId || z.Name.ToLower() != name.ToLower(), cancellationToken);
    }
}