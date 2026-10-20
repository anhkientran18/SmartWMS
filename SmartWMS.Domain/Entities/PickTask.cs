using SmartWMS.Domain.Common;

namespace SmartWMS.Domain.Entities;

public class PickTask : BaseEntity
{
    public Guid AllocationId { get; set; }
    public Guid ReservationId { get; set; }
    public InventoryReservation Reservation { get; set; } = null!;
    public Guid SourceBinId { get; set; }
    public Bin SourceBin { get; set; } = null!;
    public Guid StagingBinId { get; set; }
    public Bin StagingBin { get; set; } = null!;
    public int Quantity { get; set; }
    public int PickedQuantity { get; set; }
    public int StagedQuantity { get; set; }
    public Guid? AssignedUserId { get; set; }
    public User? AssignedUser { get; set; }
    public string Status { get; set; } = "Ready";
    public DateTime? CompletedAt { get; set; }
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();
}
