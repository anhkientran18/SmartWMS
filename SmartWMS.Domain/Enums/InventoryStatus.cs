namespace SmartWMS.Domain.Enums;

public enum InventoryStatus
{
    Available = 1,  // Hàng sẵn sàng để xuất
    Reserved = 2,   // Hàng đã được giữ chỗ cho các đơn Outbound đang chờ xử lý
    QCHold = 3,     // Hàng đang bị giữ lại để kiểm tra chất lượng
    Damaged = 4,    // Hàng bị hư hỏng (kết quả từ AI Vision/Computer Vision)
    Expired = 5     // 🌟 BỔ SUNG: Hàng hết hạn/cận hạn dùng (Kết quả quét từ FEFO Engine)
}