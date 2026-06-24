using System;

namespace SmartWMS.Domain.Entities;

public class ProductSerialNumber
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }
    public Guid? BinInventoryId { get; set; } // Liên kết vị trí ô kệ hiện tại của thiết bị
    public string SerialCode { get; set; } = string.Empty; // Mã vạch định danh độc bản (IMEI/Serial)
    public string Status { get; set; } = "InStock"; // Trạng thái: InStock, Allocated, Shipped, Damaged
    public string? OutboundOrderCode { get; set; } // Mã đơn xuất giữ chỗ phục vụ bảo hành
}