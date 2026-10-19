using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;

namespace SmartWMS.Application.Features.Zones.Specifications.Queries;

public class ZoneCountSpec : Specification<Zone>
{
    public ZoneCountSpec(string? keyword)
    {
        AndCriteria(x => !x.IsDeleted);
        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var search = keyword.Trim();
            AndCriteria(z => z.Name.Contains(search) || z.Code.Contains(search));
        }
        AsNoTracking = true;
    }
}