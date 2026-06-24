using System.Collections.Generic;

namespace SmartWMS.Application.Features.InventoryManagement.Commands.ScheduleAutoCycleCount.Dtos;

public class CycleCountSummaryDto
{
    // Mã đợt kiểm kê tự động phát sinh (Ví dụ: CC-BATCH-20260622)
    public string BatchCode { get; set; } = string.Empty;

    // Tổng số lượng ô kệ bị quét trúng diện cần kiểm tra do vượt ngưỡng giao dịch
    public int TotalBinsTargeted { get; set; }

    // Danh sách các mã Code ô kệ đích cần công nhân tới đếm lại hàng
    public List<string> TargetedBinCodes { get; set; } = new();

    // Tên tài khoản hoặc hệ thống nhân sự tự động được chỉ định thực hiện
    public string AutoAssignmentOperator { get; set; } = string.Empty;
}