using SmartWMS.Domain.Common;
using System;
using System.Collections.Generic;

namespace SmartWMS.Domain.Entities;

public class CycleCountSheet : BaseEntity
{
    // Thông tin định danh phiếu
    public string SheetNumber { get; set; } = string.Empty;
    public string BatchCode { get; set; } = string.Empty; // Bổ sung phục vụ tra cứu BatchCode
    public string Status { get; set; } = "Pending"; // Pending, Counting, Completed, Cancelled
    public string Notes { get; set; } = string.Empty;

    // Cờ phục vụ tính năng Xóa mềm (Soft Delete)
    public bool IsDeleted { get; set; } = false; // Bổ sung phục vụ Specification filtering

    // Phạm vi kiểm kê (Có thể đếm toàn bộ 1 Khu vực hoặc đếm chi tiết 1 Ô kệ)
    public Guid? ZoneId { get; set; }
    public Zone? Zone { get; set; }

    public Guid? BinId { get; set; }
    public Bin? Bin { get; set; }

    // Người được phân công đi đếm
    public Guid? AssignedUserId { get; set; }
    public User? AssignedUser { get; set; }

    // Quan hệ 1 - Nhiều: Danh sách các mặt hàng cần đếm
    public ICollection<CycleCountItem> Items { get; set; } = new List<CycleCountItem>();
}