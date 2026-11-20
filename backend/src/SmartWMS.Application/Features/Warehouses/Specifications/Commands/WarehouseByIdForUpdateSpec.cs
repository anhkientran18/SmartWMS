using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.Warehouses.Specifications.Commands;

public sealed class WarehouseByIdForUpdateSpec : Specification<Warehouse>
{
    public WarehouseByIdForUpdateSpec(Guid id)
    {
        AndCriteria(x => x.Id == id && !x.IsDeleted);
        EnableTracking(); // Bắt buộc bật Tracking để Update/Delete
    }
}