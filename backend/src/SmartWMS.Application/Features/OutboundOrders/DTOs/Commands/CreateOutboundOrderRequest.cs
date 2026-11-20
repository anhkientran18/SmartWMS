using System;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.OutboundOrders.DTOs.Commands;

public class CreateOutboundOrderRequest
{
    public string OrderNumber { get; set; } = string.Empty; // Mã đơn hàng xuất
    public Guid? CustomerId { get; set; }
    public Guid BinId { get; set; }
    public DateTime ExpectedShipDate { get; set; }
    public string Priority { get; set; } = "Normal"; // Normal, High, Urgent
    public string Notes { get; set; } = string.Empty;

    public List<OutboundOrderItemRequest> Items { get; set; } = new();
}

public class OutboundOrderItemRequest
{
    public Guid ProductId { get; set; }
    public int RequestedQuantity { get; set; }
}