using System;

namespace SmartWMS.Application.Features.InventoryTransfers.DTOs.Queries;

public class InventoryTransferDto
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string SKU { get; set; } = string.Empty;
    public int QuantityTransferred { get; set; }
    public string SourceBinCode { get; set; } = string.Empty;
    public string DestinationBinCode { get; set; } = string.Empty;
    public string ReasonCode { get; set; } = string.Empty;
    public DateTime TransferredAt { get; set; }
    public string? TransferredBy { get; set; }
}