using System;

namespace SmartWMS.Application.Features.CycleCounting.Queries.GetPendingCountTasks.Dtos;

public class CycleCountTaskDto
{
    public Guid ProductId { get; set; }
    public string SKU { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;

    // Phân loại hàng hóa theo giá trị/vòng quay (A, B, C) để ưu tiên kiểm kê
    public string ABCClassification { get; set; } = "C";

    // Tần suất chu kỳ kiểm kê định kỳ (Ví dụ: 7 ngày, 30 ngày)
    public int ScheduledIntervalDays { get; set; }

    public string TargetZone { get; set; } = string.Empty; // Khu vực đích cần đến kiểm hàng
    public string PriorityMessage { get; set; } = string.Empty; // Ghi chú mức độ khẩn cấp
}