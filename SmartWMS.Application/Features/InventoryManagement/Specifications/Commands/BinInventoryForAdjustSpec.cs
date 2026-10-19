using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.InventoryManagement.Specifications.Commands;

public sealed class BinInventoryForAdjustSpec : Specification<BinInventory>
{
    public BinInventoryForAdjustSpec(Guid binId, Guid productId, string lotNumber)
    {
        AndCriteria(x => x.BinId == binId && x.ProductId == productId && x.LotNumber == lotNumber);
        EnableTracking(); // Bật Tracking để Update Quantity
    }
}