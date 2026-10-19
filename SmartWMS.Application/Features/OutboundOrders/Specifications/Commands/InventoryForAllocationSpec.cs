using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.OutboundOrders.Specifications.Commands;

public sealed class InventoryForAllocationSpec : Specification<BinInventory>
{
    public InventoryForAllocationSpec(Guid productId)
    {
        AndCriteria(x => x.ProductId == productId && x.Quantity > 0);

        // Eager Loading Bin để lấy Code hiển thị đường đi
        AddInclude(x => x.Bin!);

        // Ưu tiên FEFO (Hết hạn trước xuất trước), nếu không có thì FIFO (Nhập trước xuất trước)
        ApplyOrderBy(x => x.ExpirationDate ?? DateTime.MaxValue);

        EnableTracking(); // Bật Tracking để trừ số lượng (Allocate)
    }
}