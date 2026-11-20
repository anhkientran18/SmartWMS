using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;

namespace SmartWMS.Application.Features.InboundReceipts.Specifications.Queries;

public class InboundReceiptCountSpec : Specification<InboundReceipt>
{
    public InboundReceiptCountSpec(string? keyword)
    {
        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var search = keyword.Trim().ToLower();
            AndCriteria(x => x.ReceiptNumber.ToLower().Contains(search) ||
                             x.ReferenceDocument.ToLower().Contains(search));
        }
        AsNoTracking = true;
    }
}