using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.InventoryManagement.Specifications.Queries;

public sealed class BinInventoryForSlottingSpec : Specification<BinInventory>
{
    public BinInventoryForSlottingSpec(Guid? zoneId)
    {
        if (zoneId.HasValue && zoneId.Value != Guid.Empty)
        {
            AndCriteria(x => x.Bin != null && x.Bin.ZoneId == zoneId.Value);
        }

        AddInclude(x => x.Product!); // Lấy kèm thông tin Sản phẩm
        AddInclude(x => x.Bin!);     // Lấy kèm thông tin Kệ

        AsNoTracking = true; // Tối ưu tốc độ đọc dữ liệu cực nhanh
    }
}