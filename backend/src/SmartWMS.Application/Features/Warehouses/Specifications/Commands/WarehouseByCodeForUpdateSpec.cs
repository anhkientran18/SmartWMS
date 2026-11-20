using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.Warehouses.Specifications.Commands;

public sealed class WarehouseByCodeForUpdateSpec : Specification<Warehouse>
{
    public WarehouseByCodeForUpdateSpec(Guid currentId, string code)
    {
        AndCriteria(x => x.Id != currentId && x.Code.ToLower() == code.ToLower() && !x.IsDeleted);
        AsNoTracking = true;
    }
}