using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.InventoryTransfers.Specifications.Queries;

public sealed class InventoryTransferPaginatedSpec : Specification<InventoryTransaction>
{
    public InventoryTransferPaginatedSpec(Guid? productId, string? keyword, int pageIndex, int pageSize)
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

        AddInclude(x => x.Product!);
        ApplyOrderByDescending(x => x.CreatedAt);
        ApplyPaging((pageIndex - 1) * pageSize, pageSize);
        AsNoTracking = true;
    }
}