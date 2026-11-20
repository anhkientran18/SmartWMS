using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.InboundReceipts.Specifications.Commands;

public sealed class InboundReceiptWithItemsByIdSpec : Specification<InboundReceipt>
{
    public InboundReceiptWithItemsByIdSpec(Guid id)
    {
        AndCriteria(x => x.Id == id);

        // Bắt buộc Include để EF Core nạp danh sách Items từ DB lên
        AddInclude(x => x.Items);

        EnableTracking(); // Bật Tracking để thực hiện Update
    }
}