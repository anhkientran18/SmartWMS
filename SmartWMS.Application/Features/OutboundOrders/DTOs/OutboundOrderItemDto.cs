using System;

namespace SmartWMS.Application.Features.OutboundOrders.DTOs;

public class OutboundOrderItemDto
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string SKU { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public bool IsDirectPick { get; set; }
    public SmartWMS.Domain.Enums.ProductTrackingMode? TrackingModeSnapshot { get; set; }
    public int ReservedQuantity { get; set; }
    public int PickedQuantity { get; set; }
    public int ShippedQuantity { get; set; }
    public List<OutboundReservationDto> Reservations { get; set; } = new();
    public string Status { get; set; } = string.Empty;
}

public sealed class OutboundReservationDto
{
    public Guid Id { get; set; }
    public Guid AllocationId { get; set; }
    public Guid SourceBinInventoryId { get; set; }
    public string? LotNumber { get; set; }
    public DateTime? ExpirationDate { get; set; }
    public int Quantity { get; set; }
    public int PickedQuantity { get; set; }
    public int ShippedQuantity { get; set; }
    public int ReleasedQuantity { get; set; }
    public string Status { get; set; } = string.Empty;
}
