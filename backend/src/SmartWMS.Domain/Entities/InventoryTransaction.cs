using System;

namespace SmartWMS.Domain.Entities;

public class InventoryTransaction
{
    // Nullable references preserve legacy history; all workflow relationships restrict deletion.
    public Guid? OutboundOrderItemId { get; set; }
    public OutboundOrderItem? OutboundOrderItem { get; set; }
    public Guid? InventoryReservationId { get; set; }
    public InventoryReservation? InventoryReservation { get; set; }
    public Guid? PickTaskId { get; set; }
    public PickTask? PickTask { get; set; }
    public Guid? OutboundPickRequestId { get; set; }
    public OutboundPickRequest? OutboundPickRequest { get; set; }
    public Guid? FulfilmentOperationRequestId { get; set; }
    public FulfilmentOperationRequest? FulfilmentOperationRequest { get; set; }
    public Guid? ShipmentId { get; set; }
    public Shipment? Shipment { get; set; }
    public Guid? BinInventoryId { get; set; }
    public BinInventory? BinInventory { get; set; }
    public Guid? DestinationBinInventoryId { get; set; }
    public BinInventory? DestinationBinInventory { get; set; }
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
