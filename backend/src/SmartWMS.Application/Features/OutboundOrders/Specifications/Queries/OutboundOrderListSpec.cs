using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.OutboundOrders.Specifications.Queries;

public sealed class OutboundOrderListSpec : Specification<OutboundIssue>
{
    public OutboundOrderListSpec(Guid? customerId, string? status, string? keyword)
    {
        AddInclude(x => x.Customer!);
        AndCriteria(x => !x.IsDeleted);

        if (customerId.HasValue && customerId.Value != Guid.Empty)
        {
            AndCriteria(x => x.CustomerId == customerId.Value);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            AndCriteria(x => x.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var search = keyword.Trim().ToLower();
            AndCriteria(x => x.OrderNumber.ToLower().Contains(search) || x.Notes.ToLower().Contains(search));
        }

        ApplyOrderByDescending(x => x.CreatedAt);
        AsNoTracking = true;
    }
}