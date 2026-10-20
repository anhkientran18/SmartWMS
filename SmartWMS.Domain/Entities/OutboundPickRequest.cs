namespace SmartWMS.Domain.Entities;

public class OutboundPickRequest
{
    public Guid RequestId { get; set; }
    public Guid AllocationId { get; set; }
    public OutboundAllocation Allocation { get; set; } = null!;
    public Guid OrderId { get; set; }
    // Null for legacy serial batches that span several lines of the same product.
    public Guid? OrderItemId { get; set; }
    public OutboundOrderItem? OrderItem { get; set; }
    public Guid ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public Guid BinId { get; set; }
    public Bin Bin { get; set; } = null!;
    public Guid StagingBinId { get; set; }
    public Bin StagingBin { get; set; } = null!;
    public string? LotNumber { get; set; }
    public SmartWMS.Domain.Enums.ProductTrackingMode TrackingMode { get; set; }
    public int QuantityPicked { get; set; }
    // SHA-256 of the natural batch identity, scoped by AllocationId in its unique index.
    public string? NaturalPickKey { get; set; }
    public string CanonicalPayload { get; set; } = string.Empty;
    public string PayloadHash { get; set; } = string.Empty;
    public string Status { get; set; } = "Completed";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? CreatedBy { get; set; }
    public DateTime CompletedAt { get; set; }
}
