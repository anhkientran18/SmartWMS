using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.Zones.Specifications.Commands;

public sealed class ZoneBinCheckForDeleteSpec : Specification<Bin>
{
    public ZoneBinCheckForDeleteSpec(Guid zoneId)
    {
        AndCriteria(x => x.ZoneId == zoneId && !x.IsDeleted);
        AsNoTracking = true;
    }
}