using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.Customers.Specifications.Commands;

public sealed class CustomerOutboundCheckForDeleteSpec : Specification<OutboundIssue>
{
    public CustomerOutboundCheckForDeleteSpec(Guid customerId)
    {
        AndCriteria(x => x.CustomerId == customerId);
        AsNoTracking = true;
    }
}