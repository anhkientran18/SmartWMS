using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;

namespace SmartWMS.Application.Features.InboundReceipts.Specifications.Commands;

public sealed class InboundReceiptByNumberSpec : Specification<InboundReceipt>
{
    public InboundReceiptByNumberSpec(string receiptNumber)
    {
        // Giả định Entity InboundReceipt của bạn có thuộc tính ReceiptNumber
        AndCriteria(x => x.ReceiptNumber.ToLower() == receiptNumber.ToLower());
        AsNoTracking = true;
    }
}