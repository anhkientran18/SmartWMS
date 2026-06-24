using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;

namespace SmartWMS.Application.Features.Warehouses.Commands;

public class DeleteWarehouseCommandHandler : IRequestHandler<DeleteWarehouseCommand, Result<bool>>
{
    private readonly IApplicationDbContext _context;

    public DeleteWarehouseCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task<Result<bool>> Handle(DeleteWarehouseCommand request, CancellationToken cancellationToken)
    {
        var warehouse = await _context.Warehouses.FindAsync(new object[] { request.Id }, cancellationToken);

        if (warehouse == null)
            return Result<bool>.Failure("Kho tổng không tồn tại hoặc đã bị xóa.");

        // RÀNG BUỘC LOGISTICS: Chặn xóa kho nếu bên trong đang có cấu hình các Khu vực (Zones)
        var hasZones = await _context.Zones.AnyAsync(z => z.WarehouseId == request.Id, cancellationToken);
        if (hasZones)
            return Result<bool>.Failure("Không thể xóa kho tổng này vì bên trong đang chứa các khu vực (Zone) hoạt động. Vui lòng xóa hết khu vực trước.");

        _context.Warehouses.Remove(warehouse);
        await _context.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, "Tháo dỡ (Xóa) kho tổng thành công.");
    }
}