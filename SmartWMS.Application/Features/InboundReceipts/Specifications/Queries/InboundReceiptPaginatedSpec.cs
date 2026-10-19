using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;

namespace SmartWMS.Application.Features.InboundReceipts.Specifications.Queries;

public class InboundReceiptPaginatedSpec : Specification<InboundReceipt>
{
    public InboundReceiptPaginatedSpec(string? keyword, int pageIndex, int pageSize)
    {
        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var search = keyword.Trim().ToLower();
            AndCriteria(x => x.ReceiptNumber.ToLower().Contains(search) ||
                             x.ReferenceDocument.ToLower().Contains(search));
        }

        AddInclude(x => x.Supplier!); // Lấy thông tin nhà cung cấp
        ApplyOrderByDescending(x => x.CreatedAt); // Phiếu mới tạo lên đầu
        ApplyPaging((pageIndex - 1) * pageSize, pageSize);
        AsNoTracking = true;
    }
}