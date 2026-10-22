namespace SmartWMS.Application.Features.OutboundOrders.DTOs.Commands;

// Whole-order pick: every active reservation must appear exactly once with its full quantity.
public sealed class DirectPickRequest
{
    public List<DirectPickItemRequest> Items { get; set; } = new();
}

public sealed class DirectPickItemRequest
{
    public Guid ReservationId { get; set; }
    public int Quantity { get; set; }
}
