using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.Bins.Specifications.Commands;

public sealed class BinInventoryCheckForDeleteSpec : Specification<BinInventory>
{
    public BinInventoryCheckForDeleteSpec(Guid binId)
    {
        AndCriteria(x => x.BinId == binId && x.Quantity > 0);
        AsNoTracking = true;
    }
}