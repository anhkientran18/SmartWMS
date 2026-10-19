using System;

namespace SmartWMS.Application.Features.OutboundOrders.DTOs.Commands;

public class ValidatePackingWeightRequest
{
    public string SKU { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public double ActualWeightGrams { get; set; }
    public Guid OrderId { get; set; }
    public decimal ActualWeight { get; set; }
}