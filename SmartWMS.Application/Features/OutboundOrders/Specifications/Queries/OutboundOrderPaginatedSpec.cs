using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.OutboundOrders.Specifications.Queries;

public sealed class OutboundOrderPaginatedSpec : Specification<OutboundIssue>
{
    public OutboundOrderPaginatedSpec(string? keyword, Guid? customerId, int pageIndex, int pageSize)
    {
        if (!string.IsNullOrWhiteSpace(keyword))
        {
            AndCriteria(x => x.Id.ToString().Contains(keyword));
        }

        if (customerId.HasValue && customerId.Value != Guid.Empty)
        {
            AndCriteria(x => x.CustomerId == customerId.Value);
        }

        ApplyOrderByDescending(x => x.CreatedAt);
        ApplyPaging((pageIndex - 1) * pageSize, pageSize);
        AddInclude(x => x.Customer!);
        AsNoTracking = true;
    }
}