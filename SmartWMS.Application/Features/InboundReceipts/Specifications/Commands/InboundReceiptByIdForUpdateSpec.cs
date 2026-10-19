using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.InboundReceipts.Specifications.Commands;

public sealed class InboundReceiptByIdForUpdateSpec : Specification<InboundReceipt>
{
    public InboundReceiptByIdForUpdateSpec(Guid id)
    {
        AddInclude(r => r.Items);
        AndCriteria(r => r.Id == id && !r.IsDeleted);
        EnableTracking(); // Bật Tracking để EF Core cập nhật entity
    }
}