using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;

namespace SmartWMS.Application.Features.InventoryManagement.Specifications.Commands;

public sealed class BinInventoriesByLpnSpec : Specification<BinInventory>
{
    public BinInventoriesByLpnSpec(string lpnCode)
    {
        // Lấy tất cả hàng hóa thuộc Pallet này đang có số lượng > 0
        AndCriteria(x => x.LpnCode == lpnCode && x.Quantity > 0);
        AddInclude(x => x.Bin!);
        EnableTracking();
    }
}