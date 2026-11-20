using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;

namespace SmartWMS.Application.Features.Warehouses.Specifications.Commands;

public sealed class WarehouseByCodeForCreateSpec : Specification<Warehouse>
{
    public WarehouseByCodeForCreateSpec(string code)
    {
        AndCriteria(x => x.Code.ToLower() == code.ToLower() && !x.IsDeleted);
        AsNoTracking = true;
    }
}