using System;

namespace SmartWMS.Application.Features.Bins.DTOs;
public class BinInventoryItemDto
{
    public Guid ProductId { get; set; }
    public string SKU { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string LotNumber { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public string ExpirationDate { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
}