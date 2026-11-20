using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;

namespace SmartWMS.Application.Features.Warehouses.Specifications.Queries;

public class WarehouseListSpec : Specification<Warehouse>
{
    public WarehouseListSpec(string? keyword)
    {
        AndCriteria(x => !x.IsDeleted);
        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var search = keyword.Trim();
            AndCriteria(w => w.Name.Contains(search) || w.Code.Contains(search));
        }
        ApplyOrderBy(w => w.Name);
        AsNoTracking = true;
    }
}