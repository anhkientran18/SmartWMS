using System;

namespace SmartWMS.Application.Features.Bins.DTOs.Commands;

public class CreateBinRequest
{
    public string Code { get; set; } = string.Empty;
    public Guid ZoneId { get; set; }
    public double Width { get; set; }
    public double Height { get; set; }
    public double Depth { get; set; }
    public double MaxCapacity { get; set; }
}