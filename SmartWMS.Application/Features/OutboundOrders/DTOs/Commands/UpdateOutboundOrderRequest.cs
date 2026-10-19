using System;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.OutboundOrders.DTOs.Commands;

public class UpdateOutboundOrderRequest
{
    public Guid Id { get; set; }
    public Guid? CustomerId { get; set; }
    public DateTime ExpectedShipDate { get; set; }
    public string Priority { get; set; } = "Normal"; // Normal, High, Urgent
    public string Notes { get; set; } = string.Empty;
    public List<UpdateOutboundOrderItemRequest> Items { get; set; } = new();
}

public class UpdateOutboundOrderItemRequest
{
    public Guid ProductId { get; set; }
    public int RequestedQuantity { get; set; }
}