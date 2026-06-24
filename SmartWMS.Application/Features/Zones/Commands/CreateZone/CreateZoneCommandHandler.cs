using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Domain.Entities;

namespace SmartWMS.Application.Features.Zones.Commands;

public class CreateZoneCommandHandler : IRequestHandler<CreateZoneCommand, Result<Guid>>
{
    private readonly IApplicationDbContext _context;
    public CreateZoneCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task<Result<Guid>> Handle(CreateZoneCommand request, CancellationToken cancellationToken)
    {
        var warehouseExists = await _context.Warehouses.AnyAsync(w => w.Id == request.WarehouseId, cancellationToken);
        if (!warehouseExists) return Result<Guid>.Failure("Nhà kho tổng không tồn tại.");

        var zone = new Zone
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            WarehouseId = request.WarehouseId
        };

        _context.Zones.Add(zone);
        await _context.SaveChangesAsync(cancellationToken);

        return Result<Guid>.Success(zone.Id, "Thêm mới khu vực (Zone) thành công.");
    }
}