using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.OutboundOrders.Specifications.Commands;

public sealed class OutboundOrderWithItemsForAllocateSpec : Specification<OutboundIssue>
{
    public OutboundOrderWithItemsForAllocateSpec(Guid orderId)
    {
        AndCriteria(x => x.Id == orderId);
        AddInclude(x => x.Items);
        EnableTracking(); // Bật Tracking để cập nhật Status
    }
}