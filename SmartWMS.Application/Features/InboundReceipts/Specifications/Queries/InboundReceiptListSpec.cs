using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.InboundReceipts.Specifications.Queries;

public sealed class InboundReceiptListSpec : Specification<InboundReceipt>
{
    public InboundReceiptListSpec(Guid? supplierId, string? status, string? keyword)
    {
        AddInclude(r => r.Supplier!);
        AndCriteria(r => !r.IsDeleted);

        if (supplierId.HasValue && supplierId.Value != Guid.Empty)
        {
            AndCriteria(r => r.SupplierId == supplierId.Value);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            AndCriteria(r => r.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var search = keyword.Trim();
            AndCriteria(r => r.ReceiptNumber.Contains(search) || r.ReferenceDocument.Contains(search));
        }

        ApplyOrderByDescending(r => r.CreatedAt);
        AsNoTracking = true;
    }
}