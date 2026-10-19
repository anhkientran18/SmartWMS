using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.InventoryTransfers.Specifications.Queries;

public sealed class InventoryTransferCountSpec : Specification<InventoryTransaction>
{
    public InventoryTransferCountSpec(Guid? productId, string? keyword)
    {
        AndCriteria(x => x.TransactionType.ToUpper() == "TRANSFER");

        if (productId.HasValue && productId.Value != Guid.Empty)
        {
            AndCriteria(x => x.ProductId == productId.Value);
        }

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var search = keyword.Trim().ToLower();
            AndCriteria(x => x.SourceBinCode.ToLower().Contains(search) ||
                             x.DestinationBinCode.ToLower().Contains(search) ||
                             x.ReasonCode.ToLower().Contains(search));
        }

        AsNoTracking = true;
    }
}