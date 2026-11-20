namespace SmartWMS.Domain.Enums;

public enum WarehouseRole
{
    Admin = 1,       // Quản trị viên hệ thống tối cao
    WarehouseManager = 2,     // Quản lý kho (Có quyền duyệt lệnh hiệu chỉnh, kiểm kho)
    Staff = 3        // Nhân viên vận hành (Quét mã vạch PDA, thực thi bốc hàng)
}