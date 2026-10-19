using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.Warehouses.Specifications.Commands;

public sealed class WarehouseZoneCheckForDeleteSpec : Specification<Zone>
{
    public WarehouseZoneCheckForDeleteSpec(Guid warehouseId)
    {
        AndCriteria(x => x.WarehouseId == warehouseId && !x.IsDeleted);
        AsNoTracking = true;
    }
}