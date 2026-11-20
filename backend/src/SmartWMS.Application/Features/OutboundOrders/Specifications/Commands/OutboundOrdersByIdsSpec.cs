using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;
using System.Collections.Generic;
using System.Linq;

namespace SmartWMS.Application.Features.OutboundOrders.Specifications.Commands;

public sealed class OutboundOrdersByIdsSpec : Specification<OutboundIssue>
{
    public OutboundOrdersByIdsSpec(List<Guid> orderIds)
    {
        AndCriteria(x => orderIds.Contains(x.Id));
        AddInclude(x => x.Items);
        // AddInclude($"{nameof(OutboundIssue.Items)}.{nameof(OutboundOrderItem.Product)}"); // Join Product để lấy tên
        EnableTracking(); // Bật tracking nếu Wave Pick sẽ cập nhật Status của các đơn này
    }
}