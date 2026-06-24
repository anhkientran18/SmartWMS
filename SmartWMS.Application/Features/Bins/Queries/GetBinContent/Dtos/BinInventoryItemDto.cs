using System;

namespace SmartWMS.Application.Features.Bins.Queries.GetBinContent.Dtos;

public class BinInventoryItemDto
{
    public Guid ProductId { get; set; }
    public string SKU { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string LotNumber { get; set; } = string.Empty; // Số lô sản xuất
    public int Quantity { get; set; }
    public string ExpirationDate { get; set; } = string.Empty; // Hạn sử dụng (Định dạng chuỗi phục vụ UI)
    public string Status { get; set; } = string.Empty; // Trạng thái: Available, Khóa, Cách ly...
}