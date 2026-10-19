using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;

namespace SmartWMS.Application.Features.Warehouses.Specifications.Queries;

public class WarehousePaginatedListSpec : Specification<Warehouse>
{
    public WarehousePaginatedListSpec(string? keyword, int pageIndex, int pageSize)
    {
        AndCriteria(x => !x.IsDeleted);
        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var search = keyword.Trim();
            AndCriteria(w => w.Name.Contains(search) || w.Code.Contains(search));
        }
        ApplyOrderBy(w => w.Name);
        ApplyPaging((pageIndex - 1) * pageSize, pageSize);
        AsNoTracking = true;
    }
}