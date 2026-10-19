using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Dashboard.DTOs.Queries;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Dashboard.Queries.GetWarehouseOccupancy;

public class GetWarehouseOccupancyQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetWarehouseOccupancyQuery, Result<List<WarehouseOccupancyDto>>>
{
    public async Task<Result<List<WarehouseOccupancyDto>>> Handle(GetWarehouseOccupancyQuery request, CancellationToken cancellationToken)
    {
        var warehouses = await context.Warehouses.AsNoTracking()
            .Where(x => !x.IsDeleted)
            .OrderBy(x => x.Code).ThenBy(x => x.Id)
            .Select(x => new WarehouseOccupancyDto
            {
                WarehouseId = x.Id,
                WarehouseCode = x.Code,
                WarehouseName = x.Name
            }).ToListAsync(cancellationToken);

        var usage = await context.Bins.AsNoTracking()
            .Where(x => !x.IsDeleted && x.Zone != null && !x.Zone.IsDeleted && !x.Zone.Warehouse.IsDeleted)
            .GroupBy(x => x.Zone!.WarehouseId)
            .Select(g => new
            {
                WarehouseId = g.Key,
                BinCount = g.Count(),
                TotalCapacity = g.Sum(x => x.MaxCapacity),
                CurrentOccupancy = g.Sum(x => x.CurrentOccupancy)
            }).ToDictionaryAsync(x => x.WarehouseId, cancellationToken);

        foreach (var warehouse in warehouses)
        {
            if (usage.TryGetValue(warehouse.WarehouseId, out var total))
            {
                warehouse.BinCount = total.BinCount;
                warehouse.TotalCapacity = total.TotalCapacity;
                warehouse.CurrentOccupancy = total.CurrentOccupancy;
            }
            warehouse.OccupancyPercentage = warehouse.TotalCapacity > 0
                ? Math.Round(warehouse.CurrentOccupancy / warehouse.TotalCapacity * 100, 2)
                : null;
        }

        return Result<List<WarehouseOccupancyDto>>.Success(warehouses);
    }
}
