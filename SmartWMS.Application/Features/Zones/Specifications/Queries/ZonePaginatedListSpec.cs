using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;

namespace SmartWMS.Application.Features.Zones.Specifications.Queries;

public class ZonePaginatedListSpec : Specification<Zone>
{
    public ZonePaginatedListSpec(string? keyword, int pageIndex, int pageSize)
    {
        AndCriteria(x => !x.IsDeleted);
        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var search = keyword.Trim();
            AndCriteria(z => z.Name.Contains(search) || z.Code.Contains(search));
        }
        ApplyOrderBy(z => z.Name);
        ApplyPaging((pageIndex - 1) * pageSize, pageSize);
        AsNoTracking = true;
    }
}