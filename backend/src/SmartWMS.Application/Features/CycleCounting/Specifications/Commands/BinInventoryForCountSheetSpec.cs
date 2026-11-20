using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Specifications;
using System;

namespace SmartWMS.Application.Features.CycleCounting.Specifications.Commands;

public sealed class BinInventoryForCountSheetSpec : Specification<BinInventory>
{
    public BinInventoryForCountSheetSpec(Guid? zoneId, Guid? binId)
    {
        if (binId.HasValue && binId.Value != Guid.Empty)
        {
            AndCriteria(x => x.BinId == binId.Value);
        }
        else if (zoneId.HasValue && zoneId.Value != Guid.Empty)
        {
            // Join với Bin để lọc theo ZoneId
            AndCriteria(x => x.Bin != null && x.Bin.ZoneId == zoneId.Value);
        }

        AddInclude(x => x.Bin!); // Kéo theo thông tin Kệ để ghi vào phiếu
        AsNoTracking = true; // Chỉ lấy dữ liệu để khởi tạo phiếu, không cần Tracking
    }
}