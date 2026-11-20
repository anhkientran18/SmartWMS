using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;

namespace SmartWMS.Application.Features.Warehouses.Specifications.Queries;

public class WarehouseCountSpec : Specification<Warehouse>
{
    public WarehouseCountSpec(string? keyword)
    {
        AndCriteria(x => !x.IsDeleted);
        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var search = keyword.Trim();
            AndCriteria(w => w.Name.Contains(search) || w.Code.Contains(search));
        }
        AsNoTracking = true;
    }
}