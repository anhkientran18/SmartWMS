using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.OutboundOrders.Specifications.Queries;

public sealed class OutboundOrderCountSpec : Specification<OutboundIssue>
{
    public OutboundOrderCountSpec(string? keyword, Guid? customerId)
    {
        if (!string.IsNullOrWhiteSpace(keyword))
        {
            AndCriteria(x => x.Id.ToString().Contains(keyword));
        }

        if (customerId.HasValue && customerId.Value != Guid.Empty)
        {
            AndCriteria(x => x.CustomerId == customerId.Value);
        }
    }
}