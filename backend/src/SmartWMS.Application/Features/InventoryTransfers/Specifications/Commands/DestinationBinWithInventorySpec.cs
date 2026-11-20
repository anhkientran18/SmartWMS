using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.InventoryTransfers.Specifications.Commands;

public sealed class DestinationBinWithInventorySpec : Specification<Bin>
{
    public DestinationBinWithInventorySpec(Guid destinationBinId)
    {
        AndCriteria(x => x.Id == destinationBinId && !x.IsDeleted);
        EnableTracking();
    }
}