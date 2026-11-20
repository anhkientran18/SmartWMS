using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.Bins.Specifications.Commands;

public sealed class BinByCodeAndZoneForUpdateSpec : Specification<Bin>
{
    public BinByCodeAndZoneForUpdateSpec(Guid currentBinId, string code, Guid zoneId)
    {
        AndCriteria(x => x.Id != currentBinId && x.ZoneId == zoneId && x.Code.ToLower() == code.ToLower() && !x.IsDeleted);
        AsNoTracking = true;
    }
}