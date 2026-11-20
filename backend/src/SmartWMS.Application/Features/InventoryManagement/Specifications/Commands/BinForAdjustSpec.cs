using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.InventoryManagement.Specifications.Commands;

public sealed class BinForAdjustSpec : Specification<Bin>
{
    public BinForAdjustSpec(Guid binId)
    {
        AndCriteria(x => x.Id == binId && !x.IsDeleted);
        EnableTracking(); // Bật Tracking để Update CurrentOccupancy
    }
}