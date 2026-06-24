using System;

namespace SmartWMS.Domain.Entities;

public class OutboundOrderItem
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }
    public int Quantity { get; set; }
    public string Status { get; set; } = "Pending"; // Trạng thái luồng: Pending, Allocated, Picked, Shipped
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}