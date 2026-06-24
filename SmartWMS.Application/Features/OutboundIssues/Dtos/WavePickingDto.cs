using System;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.OutboundIssues.Dtos;

public class WavePickingDto
{
    // Mã đợt gom đơn xuất kho (Wave ID)
    public Guid WaveId { get; set; }

    // Danh sách lộ trình nhặt hàng đã được thuật toán tối ưu đường đi
    public List<PickingItemDto> OptimizedRoute { get; set; } = new();
}

public class PickingItemDto
{
    public Guid ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string SKU { get; set; } = string.Empty;
    public string BinCode { get; set; } = string.Empty; // Ô kệ cần đến lấy hàng
    public int TotalQuantityToPick { get; set; }        // Tổng số lượng cần nhặt
    public List<Guid> AssociatedOrderIds { get; set; } = new(); // Các đơn hàng chứa sản phẩm này
}