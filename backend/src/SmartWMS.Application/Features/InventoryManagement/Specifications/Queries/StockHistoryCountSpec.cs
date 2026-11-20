using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.InventoryManagement.Specifications.Queries;

public sealed class StockHistoryCountSpec : Specification<InventoryTransaction>
{
    public StockHistoryCountSpec(Guid? productId, string? transactionType)
    {
        if (productId.HasValue && productId.Value != Guid.Empty)
        {
            AndCriteria(x => x.ProductId == productId.Value);
        }

        if (!string.IsNullOrWhiteSpace(transactionType))
        {
            var type = transactionType.Trim().ToUpper();
            AndCriteria(x => x.TransactionType.ToUpper() == type);
        }
        AsNoTracking = true;
    }
}