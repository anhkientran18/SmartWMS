using System;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.Bins.DTOs;

public class BinContentHeaderDto
{
    public Guid BinId { get; set; }
    public string BinCode { get; set; } = string.Empty;
    public double MaxCapacity { get; set; }
    public double CurrentOccupancy { get; set; }
    public double UtilizationPercentage { get; set; }
    public List<BinInventoryItemDto> Items { get; set; } = new();
}