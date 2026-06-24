using SmartWMS.Domain.Common;

namespace SmartWMS.Domain.Entities;

public class Supplier : BaseEntity
{
    public string Code { get; set; } = string.Empty; // Mã NCC: VENDOR-LENOVO
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty; // 🌟 Trục dữ liệu để AI lấy gửi mail restock!
    public string Phone { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
}