using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.OutboundOrders.Specifications.Commands;

public sealed class OutboundOrderByIdForUpdateSpec : Specification<OutboundIssue>
{
    public OutboundOrderByIdForUpdateSpec(Guid id)
    {
        AddInclude(x => x.Items);
        AndCriteria(x => x.Id == id && !x.IsDeleted);
        EnableTracking(); // Bật Tracking để EF Core cập nhật thay đổi
    }
}