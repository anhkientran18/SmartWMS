using SmartWMS.Domain.Enums;
using System;

namespace SmartWMS.Application.Features.InventoryManagement.DTOs.Commands;

public class ChangeStockStatusRequest
{
    public Guid BinId { get; set; }
    public Guid ProductId { get; set; }
    public string LotNumber { get; set; } = string.Empty;
    public InventoryStatus NewStatus { get; set; } // Available, Locked, Quarantined, Damaged...
    public string ReasonCode { get; set; } = string.Empty;
}