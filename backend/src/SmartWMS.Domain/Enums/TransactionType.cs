namespace SmartWMS.Domain.Enums;

public enum TransactionType
{
    Inbound = 1,     // Nhập kho (Ứng với chuỗi "INBOUND" trước đây)
    Outbound = 2,    // Xuất kho (Ứng với chuỗi "OUTBOUND" trước đây)
    Transfer = 3,    // Điều chuyển nội bộ ô kệ/Auto-Replenish (Ứng với chuỗi "TRANSFER")
    Adjustment = 4   // Hiệu chỉnh, cân đối kho do thất thoát (Ứng với chuỗi "ADJUSTMENT")
}