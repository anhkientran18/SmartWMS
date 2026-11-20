using System;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.OutboundOrders.DTOs.Commands;

public class PickWithSerialRequest
{
    public Guid OrderId { get; set; }
    public string OrderCode { get; set; } = string.Empty;
    public Guid ProductId { get; set; }
    public Guid BinId { get; set; }
    public string SerialNumber { get; set; } = string.Empty;
    public List<string> ScannedSerials { get; set; } = new();
}