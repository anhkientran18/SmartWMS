using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;

namespace SmartWMS.Application.Features.InboundReceipts.Specifications.Queries;

public sealed class BinForPutawaySpec : Specification<Bin>
{
    public BinForPutawaySpec(string targetZoneName, int quantityNeeded)
    {
        // 1. Chỉ tìm kệ thuộc Zone mong muốn, không bị xóa và còn đủ sức chứa
        AddInclude(b => b.Zone!);
        AndCriteria(b => !b.IsDeleted
                      && b.Zone!.Name == targetZoneName
                      && (b.CurrentOccupancy + quantityNeeded) <= b.MaxCapacity);

        // 2. Thuật toán gom hàng: Ưu tiên kệ đang có sẵn hàng (để tối ưu không gian)
        ApplyOrderByDescending(b => b.CurrentOccupancy);
        AsNoTracking = true;
    }
}