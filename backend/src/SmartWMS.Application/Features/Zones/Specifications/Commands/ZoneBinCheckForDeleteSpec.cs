using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.Zones.Specifications.Commands;

public sealed class ZoneBinCheckForDeleteSpec : Specification<Bin>
{
    public ZoneBinCheckForDeleteSpec(Guid zoneId)
    {
        // Physical zone deletion must also preserve soft-deleted bins and their history.
        AndCriteria(x => x.ZoneId == zoneId);
        AsNoTracking = true;
    }
}
