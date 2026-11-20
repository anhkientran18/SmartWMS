using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.Bins.Specifications.Queries;

public sealed class BinPaginatedByZoneIdSpec : Specification<Bin>
{
    public BinPaginatedByZoneIdSpec(Guid? zoneId, string? keyword, int pageNumber, int pageSize)
    {
        AndCriteria(b => !b.IsDeleted);

        // Nếu có truyền ZoneId hợp lệ thì mới lọc theo ZoneId
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
        ApplyPaging((pageNumber - 1) * pageSize, pageSize);
        AsNoTracking = true;
    }
}