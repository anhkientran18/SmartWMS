using FluentValidation;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Features.Zones.Commands;

namespace SmartWMS.Application.Features.Zones.Commands.UpdateZone;

public class UpdateZoneCommandValidator : AbstractValidator<UpdateZoneCommand>
{
    private readonly IApplicationDbContext _context;

    public UpdateZoneCommandValidator(IApplicationDbContext context)
    {
        _context = context;

        // 1. Kiểm tra Id của Zone cần chỉnh sửa
        RuleFor(v => v.Id)
            .NotEmpty().WithMessage("Mã định danh (Id) khu vực không được để trống.");

        // 2. Kiểm tra Tên khu vực mới
        RuleFor(v => v.Name)
            .NotEmpty().WithMessage("Tên khu vực (Zone) không được để trống.")
            .MaximumLength(100).WithMessage("Tên khu vực không được vượt quá 100 ký tự.")
            .MustAsync(BeUniqueNameExceptSelf).WithMessage("Tên khu vực này đã được sử dụng bởi một phân khu khác trong kho.");

        // 3. Kiểm tra Nhà kho quản lý
        RuleFor(v => v.WarehouseId)
            .NotEmpty().WithMessage("Khu vực kho phải thuộc về một Nhà kho hợp lệ.");
    }

    private async Task<bool> BeUniqueNameExceptSelf(UpdateZoneCommand command, string name, CancellationToken cancellationToken)
    {
        // Đảm bảo tên sửa không trùng với các khu vực khác trong cùng một nhà kho (bỏ qua bản ghi hiện tại)
        return await _context.Zones
            .AllAsync(z => z.Id == command.Id ||
                           z.WarehouseId != command.WarehouseId ||
                           z.Name.ToLower() != name.ToLower(), cancellationToken);
    }
}