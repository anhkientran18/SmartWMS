using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.Warehouses.Specifications.Queries;

public class WarehouseByIdSpec : Specification<Warehouse>
{
    public WarehouseByIdSpec(Guid id)
    {
        AndCriteria(x => x.Id == id && !x.IsDeleted);
        AsNoTracking = true;
    }
}