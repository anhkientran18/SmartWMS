using System;

namespace SmartWMS.Application.Features.InventoryManagement.DTOs.Commands;

public class MoveLpnRequest
{
    public string LpnCode { get; set; } = string.Empty;
    public Guid ToBinId { get; set; }
}