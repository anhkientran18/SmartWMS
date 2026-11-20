using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.InventoryManagement.Specifications.Commands;

public sealed class TargetBinForMoveSpec : Specification<Bin>
{
    public TargetBinForMoveSpec(Guid id)
    {
        AndCriteria(x => x.Id == id && !x.IsDeleted);
        EnableTracking(); // Bật Tracking để cộng dung lượng mới
    }
}