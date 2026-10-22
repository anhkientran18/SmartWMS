using System;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.OutboundOrders.DTOs;

public class OutboundOrderDto
{
    public Guid Id { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public bool IsDirectPick { get; set; }
    public Guid? CustomerId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public Guid BinId { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public string? CreatedBy { get; set; }

    // 🌟 BỔ SUNG: Thuộc tính danh sách chi tiết mặt hàng xuất kho
    public List<OutboundOrderItemDto> Items { get; set; } = new();
}
