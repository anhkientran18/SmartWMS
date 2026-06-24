using SmartWMS.Domain.Common;
using System;

namespace SmartWMS.Domain.Entities;

public class MovementTask : BaseEntity
{
    public string TaskNumber { get; set; } = string.Empty; // TASK-PICK-001, TASK-PUTAWAY-002
    public string TaskType { get; set; } = string.Empty; // PICKING, PUTAWAY, REPLENISH

    public Guid? AssignedUserId { get; set; } // Giao cho nhân viên nào xử lý
    public User? AssignedUser { get; set; }

    public string Status { get; set; } = "Pending"; // Pending, InProgress, Completed, Failed
    public int OptimizedSequence { get; set; } // Số thứ tự ưu tiên di chuyển (Kết quả từ S-Shape Engine)

    public Guid ProductId { get; set; }
    public int Quantity { get; set; }
    public string SourceBin { get; set; } = string.Empty;
    public string DestinationBin { get; set; } = string.Empty;
}