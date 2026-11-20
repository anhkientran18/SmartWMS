using System;

namespace SmartWMS.Application.Features.Dashboard.DTOs.Queries;

public class WarehouseOccupancyDto
{
    public Guid WarehouseId { get; set; }
    public string WarehouseCode { get; set; } = string.Empty;
    public string WarehouseName { get; set; } = string.Empty;
    public int BinCount { get; set; }
    public double TotalCapacity { get; set; }
    public double CurrentOccupancy { get; set; }
    public double? OccupancyPercentage { get; set; }
}
