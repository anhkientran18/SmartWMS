using SmartWMS.Domain.Common;
using System;
using System.Collections.Generic;

namespace SmartWMS.Domain.Entities;

public class Zone : BaseEntity
{
    // Bổ sung mã định danh khu vực
    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    // Bổ sung cờ (flag) phục vụ tính năng Xóa mềm (Soft Delete)
    public bool IsDeleted { get; set; } = false;

    public Guid WarehouseId { get; set; }
    public Warehouse Warehouse { get; set; } = null!;
    public ICollection<Bin> Bins { get; set; } = new HashSet<Bin>();
}