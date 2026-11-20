using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.Bins.Specifications.Commands;

public sealed class BinByCodeAndZoneForCreateSpec : Specification<Bin>
{
    public BinByCodeAndZoneForCreateSpec(string code, Guid zoneId)
    {
        AndCriteria(x => x.ZoneId == zoneId && x.Code.ToLower() == code.ToLower() && !x.IsDeleted);
        AsNoTracking = true;
    }
}