using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Warehouses.DTOs;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Warehouses.Queries.GetList;

public sealed class GetWarehouseListQueryHandler : IRequestHandler<GetWarehouseListQuery, Result<List<WarehouseDto>>>
{
    private readonly IApplicationDbContext _context;

    public GetWarehouseListQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<List<WarehouseDto>>> Handle(GetWarehouseListQuery request, CancellationToken cancellationToken)
    {
        // Đọc trực tiếp từ DB
        var items = await _context.Warehouses
            .AsNoTracking()
            .Where(x => !x.IsDeleted)
            .OrderBy(x => x.Name)
            .Select(x => new WarehouseDto
            {
                Id = x.Id,
                Code = x.Code ?? string.Empty,
                Name = x.Name ?? string.Empty,
                Address = x.Address ?? string.Empty
            })
            .ToListAsync(cancellationToken);

        return Result<List<WarehouseDto>>.Success(items);
    }
}