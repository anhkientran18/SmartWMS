using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.Zones.Specifications.Commands;

public sealed class ZoneByCodeForUpdateSpec : Specification<Zone>
{
    public ZoneByCodeForUpdateSpec(Guid currentZoneId, string code, Guid warehouseId)
    {
        AndCriteria(x => x.Id != currentZoneId && x.WarehouseId == warehouseId && x.Code.ToLower() == code.ToLower() && !x.IsDeleted);
        AsNoTracking = true;
    }
}