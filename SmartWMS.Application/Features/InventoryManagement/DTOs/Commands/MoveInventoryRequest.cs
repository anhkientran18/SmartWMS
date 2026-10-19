using System;

namespace SmartWMS.Application.Features.InventoryManagement.DTOs.Commands;

public class MoveInventoryRequest
{
    public Guid ProductId { get; set; }
    public Guid FromBinId { get; set; }
    public Guid ToBinId { get; set; }
    public int Quantity { get; set; }
    public string Reason { get; set; } = string.Empty;
}