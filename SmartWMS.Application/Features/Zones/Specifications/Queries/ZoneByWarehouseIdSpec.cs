using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.Zones.Specifications.Queries;

public class ZoneByWarehouseIdSpec : Specification<Zone>
{
    public ZoneByWarehouseIdSpec(Guid warehouseId)
    {
        AndCriteria(x => x.WarehouseId == warehouseId && !x.IsDeleted);
        ApplyOrderBy(x => x.Name);
        AsNoTracking = true;
    }
}