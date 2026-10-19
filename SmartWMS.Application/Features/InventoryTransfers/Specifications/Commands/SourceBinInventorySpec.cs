using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using SmartWMS.Domain.Enums;
using System;

namespace SmartWMS.Application.Features.InventoryTransfers.Specifications.Commands;

public sealed class SourceBinInventorySpec : Specification<BinInventory>
{
    public SourceBinInventorySpec(Guid sourceBinId, Guid productId, string lotNumber)
    {
        AndCriteria(x => x.BinId == sourceBinId && x.ProductId == productId &&
            x.LotNumber == lotNumber && x.Status == InventoryStatus.Available);
        AddInclude(x => x.Bin!);
        EnableTracking();
    }
}