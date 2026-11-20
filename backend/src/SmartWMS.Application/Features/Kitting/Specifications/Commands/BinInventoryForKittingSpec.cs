using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.Kitting.Specifications.Commands;

public sealed class BinInventoryForKittingSpec : Specification<BinInventory>
{
    public BinInventoryForKittingSpec(Guid binId, Guid productId)
    {
        AndCriteria(x => x.BinId == binId && x.ProductId == productId);
        EnableTracking(); // Bật Tracking để Update số lượng
    }
}