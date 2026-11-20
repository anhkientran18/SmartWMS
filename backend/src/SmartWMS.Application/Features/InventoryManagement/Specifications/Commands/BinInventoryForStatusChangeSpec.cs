using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.InventoryManagement.Specifications.Commands;

public sealed class BinInventoryForStatusChangeSpec : Specification<BinInventory>
{
    public BinInventoryForStatusChangeSpec(Guid binId, Guid productId, string lotNumber)
    {
        AndCriteria(x => x.BinId == binId && x.ProductId == productId && x.LotNumber == lotNumber);
        AddInclude(x => x.Bin!); // Kéo theo thông tin kệ để ghi Log cho chi tiết
        EnableTracking(); // Bật Tracking để Update
    }
}