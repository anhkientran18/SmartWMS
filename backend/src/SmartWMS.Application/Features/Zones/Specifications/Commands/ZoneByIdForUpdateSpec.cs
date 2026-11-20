using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.Zones.Specifications.Commands;

public sealed class ZoneByIdForUpdateSpec : Specification<Zone>
{
    public ZoneByIdForUpdateSpec(Guid id)
    {
        AndCriteria(x => x.Id == id && !x.IsDeleted);
        EnableTracking(); // Bắt buộc bật để Update/Delete
    }
}