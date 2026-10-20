using SmartWMS.Domain.Common;

namespace SmartWMS.Domain.Entities;

public class ShipmentItem : BaseEntity
{
    public Guid ShipmentId { get; set; }
    public Shipment Shipment { get; set; } = null!;
    public Guid AllocationId { get; set; }
    public Guid OrderId { get; set; }
    public Guid OrderItemId { get; set; }
    public Guid ReservationId { get; set; }
    public InventoryReservation Reservation { get; set; } = null!;
    public Guid BinInventoryId { get; set; }
    public BinInventory BinInventory { get; set; } = null!;
    public int Quantity { get; set; }
}
