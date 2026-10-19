using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.Zones.Specifications.Commands;

public sealed class ZoneByCodeForCreateSpec : Specification<Zone>
{
    public ZoneByCodeForCreateSpec(string code, Guid warehouseId)
    {
        AndCriteria(x => x.WarehouseId == warehouseId && x.Code.ToLower() == code.ToLower() && !x.IsDeleted);
        AsNoTracking = true;
    }
}