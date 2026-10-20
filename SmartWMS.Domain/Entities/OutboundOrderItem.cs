using System;

namespace SmartWMS.Domain.Entities;

using SmartWMS.Domain.Enums;

public class OutboundOrderItem
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }
    public int Quantity { get; set; }
    // Null marks a legacy line which has not entered the new allocation workflow.
    public ProductTrackingMode? TrackingModeSnapshot { get; set; }
    public int ReservedQuantity { get; set; }
    public int PickedQuantity { get; set; }
    public int StagedQuantity { get; set; }
    public int ShippedQuantity { get; set; }
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();
    public string Status { get; set; } = "Pending"; // Trạng thái luồng: Pending, Allocated, Picked, Shipped
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}