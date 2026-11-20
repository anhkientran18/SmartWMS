using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;

namespace SmartWMS.Application.Features.Zones.Specifications.Queries;

public class ZoneListSpec : Specification<Zone>
{
    public ZoneListSpec(string? keyword)
    {
        AndCriteria(x => !x.IsDeleted);
        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var search = keyword.Trim();
            AndCriteria(z => z.Name.Contains(search) || z.Code.Contains(search));
        }
        ApplyOrderBy(z => z.Name);
        AsNoTracking = true;
    }
}