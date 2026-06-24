using System;

namespace SmartWMS.Domain.Entities;

public class InventoryTransaction
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }
    public string TransactionType { get; set; } = string.Empty; // INBOUND, OUTBOUND, TRANSFER, ADJUSTMENT
    public int QuantityChanged { get; set; }
    public string SourceBinCode { get; set; } = string.Empty;
    public string DestinationBinCode { get; set; } = string.Empty;
    public string ReasonCode { get; set; } = string.Empty;
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}