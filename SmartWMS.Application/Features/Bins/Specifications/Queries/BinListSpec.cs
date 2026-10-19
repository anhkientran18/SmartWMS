using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.Bins.Specifications.Queries;

public sealed class BinListSpec : Specification<Bin>
{
    public BinListSpec(Guid? zoneId, string? keyword)
    {
        AndCriteria(b => !b.IsDeleted);

        if (zoneId.HasValue && zoneId.Value != Guid.Empty)
        {
            AndCriteria(b => b.ZoneId == zoneId.Value);
        }

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var search = keyword.Trim();
            AndCriteria(b => b.Code.Contains(search));
        }

        ApplyOrderBy(b => b.Code);
        AsNoTracking = true;
    }
}