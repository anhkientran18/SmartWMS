using System;

namespace SmartWMS.Application.Features.Zones.DTOs.Commands;

public class UpdateZoneRequest
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}