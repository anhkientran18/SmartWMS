using SmartWMS.Domain.Common;

namespace SmartWMS.Domain.Entities;

public class InventoryReservation : BaseEntity
{
    public Guid AllocationId { get; set; }
    public OutboundAllocation Allocation { get; set; } = null!;
    // These composite relationships must identify a line from the same order/cycle.
    public Guid OrderId { get; set; }
    public Guid OrderItemId { get; set; }
    public OutboundOrderItem OrderItem { get; set; } = null!;
    public Guid SourceBinInventoryId { get; set; }
    public BinInventory SourceBinInventory { get; set; } = null!;
    public Guid? StagingBinInventoryId { get; set; }
    public BinInventory? StagingBinInventory { get; set; }
    public int Quantity { get; set; }
    public int PickedQuantity { get; set; }
    public int ShippedQuantity { get; set; }
    public int ReleasedQuantity { get; set; }
    public string Status { get; set; } = "Active";
    public DateTime? CompletedAt { get; set; }
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();
}
