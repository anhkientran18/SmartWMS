using System;

namespace SmartWMS.Application.Features.Zones.DTOs.Commands;

public class CreateZoneRequest
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public Guid WarehouseId { get; set; }
}