using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.Zones.Specifications.Queries;

public sealed class ZoneByIdSpec : Specification<Zone>
{
    public ZoneByIdSpec(Guid id)
    {
        AndCriteria(x => x.Id == id && !x.IsDeleted);
        AsNoTracking = true;
    }
}