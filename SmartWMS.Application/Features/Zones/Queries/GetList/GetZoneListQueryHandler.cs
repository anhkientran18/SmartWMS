using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Zones.DTOs;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Zones.Queries.GetList;

public sealed class GetZoneListQueryHandler : IRequestHandler<GetZoneListQuery, Result<List<ZoneDto>>>
{
    private readonly IApplicationDbContext _context;

    public GetZoneListQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<List<ZoneDto>>> Handle(GetZoneListQuery request, CancellationToken cancellationToken)
    {
        var items = await _context.Zones
            .AsNoTracking()
            .Where(x => !x.IsDeleted)
            .OrderBy(x => x.Name)
            .Select(x => new ZoneDto
            {
                Id = x.Id,
                WarehouseId = x.WarehouseId,
                Code = x.Code,
                Name = x.Name
            })
            .ToListAsync(cancellationToken);

        return Result<List<ZoneDto>>.Success(items);
    }
}