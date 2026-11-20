using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;

namespace SmartWMS.Application.Features.OutboundOrders.Specifications.Commands;

public sealed class OutboundOrderByNumberSpec : Specification<OutboundIssue>
{
    public OutboundOrderByNumberSpec(string orderNumber)
    {
        AndCriteria(x => x.OrderNumber == orderNumber);
    }
}
