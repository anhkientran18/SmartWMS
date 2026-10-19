using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.InboundReceipts.Specifications.Queries;

public class InboundReceiptByIdSpec : Specification<InboundReceipt>
{
    public InboundReceiptByIdSpec(Guid id)
    {
        AndCriteria(x => x.Id == id);

        // Eager Loading (Lấy sẵn dữ liệu quan hệ để Handler không cần truy vấn lại)
        AddInclude(x => x.Supplier!);
        AddInclude($"{nameof(InboundReceipt.Items)}.{nameof(InboundReceiptItem.Product)}");

        AsNoTracking = true;
    }
}