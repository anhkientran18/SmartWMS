using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Zones.Dtos;

namespace SmartWMS.Application.Features.Zones.Queries;

public class GetZonesByWarehouseIdQueryHandler : IRequestHandler<GetZonesByWarehouseIdQuery, Result<List<ZoneDto>>>
{
    private readonly IApplicationDbContext _context;
    public GetZonesByWarehouseIdQueryHandler(IApplicationDbContext context) => _context = context;

    public async Task<Result<List<ZoneDto>>> Handle(GetZonesByWarehouseIdQuery request, CancellationToken cancellationToken)
    {
        var list = await _context.Zones.AsNoTracking()
            .Include(z => z.Warehouse)
            .Where(z => z.WarehouseId == request.WarehouseId)
            .Select(z => new ZoneDto
            {
                Id = z.Id,
                Name = z.Name,
                WarehouseId = z.WarehouseId,
                WarehouseName = z.Warehouse != null ? z.Warehouse.Name : string.Empty
            })
            .ToListAsync(cancellationToken);

        return Result<List<ZoneDto>>.Success(list);
    }
}