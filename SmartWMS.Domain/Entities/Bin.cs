using System;
using System.Collections.Generic; // BỔ SUNG: Thư viện quản lý danh sách ICollection

namespace SmartWMS.Domain.Entities;

public class Bin
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public Guid ZoneId { get; set; }
    public Zone? Zone { get; set; }
    public double MaxCapacity { get; set; }
    public double CurrentOccupancy { get; set; }

    // Nhật ký khởi tạo ban đầu
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string CreatedBy { get; set; } = string.Empty;

    // Cấu hình phục vụ xóa mềm và kiểm toán dữ liệu
    public bool IsDeleted { get; set; } = false;
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }

    // ============================================================================
    // BỔ SUNG QUAN TRỌNG: Khai báo liên kết trỏ ngược danh sách tồn kho của ô kệ này
    // ============================================================================
    public ICollection<BinInventory> BinInventories { get; set; } = new List<BinInventory>();
}