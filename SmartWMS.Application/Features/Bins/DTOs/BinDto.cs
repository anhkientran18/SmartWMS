using System;

namespace SmartWMS.Application.Features.Bins.DTOs;

public class BinDto
{
    public Guid Id { get; set; }
    public string Code { get; set; } = default!;
    public Guid ZoneId { get; set; }
    public double MaxCapacity { get; set; }
    public double CurrentOccupancy { get; set; }
}