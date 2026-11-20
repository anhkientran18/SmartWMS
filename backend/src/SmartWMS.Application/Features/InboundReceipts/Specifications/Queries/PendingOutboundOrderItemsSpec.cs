using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.InboundReceipts.Specifications.Commands;

public sealed class PendingOutboundOrderItemsSpec : Specification<OutboundOrderItem>
{
    public PendingOutboundOrderItemsSpec(Guid productId)
    {
        AndCriteria(x => x.ProductId == productId && x.Status == "Pending");
        ApplyOrderBy(x => x.CreatedAt); // Ưu tiên đơn hàng cũ nhất (FIFO)
        EnableTracking(); // Bật Tracking để Update Status thành Allocated
    }
}