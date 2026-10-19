using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.InventoryManagement.Specifications.Queries;

public sealed class StockHistoryPaginatedSpec : Specification<InventoryTransaction>
{
    public StockHistoryPaginatedSpec(Guid? productId, string? transactionType, int pageIndex, int pageSize)
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

        AddInclude(x => x.Product!); // Join lấy tên sản phẩm
        ApplyOrderByDescending(x => x.CreatedAt); // Giao dịch mới nhất lên đầu
        ApplyPaging((pageIndex - 1) * pageSize, pageSize);
        AsNoTracking = true;
    }
}