using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.OutboundOrders.Specifications.Queries;

public sealed class OutboundOrderByIdSpec : Specification<OutboundIssue> // Tạm dùng Entity OutboundIssue gốc của bạn
{
    public OutboundOrderByIdSpec(Guid id)
    {
        AndCriteria(x => x.Id == id);

        // Eager Loading: Lấy kèm Customer và Product bên trong Items
        AddInclude(x => x.Customer!);
        AddInclude($"{nameof(OutboundIssue.Items)}.{nameof(OutboundOrderItem.Product)}");

        AsNoTracking = true;
    }
}