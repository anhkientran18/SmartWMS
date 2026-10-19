using System;

namespace SmartWMS.Application.Features.CycleCounting.DTOs.Queries;

public class CycleCountTaskDto
{
    public Guid CountSheetId { get; set; }
    public Guid ItemId { get; set; }
    public string SheetNumber { get; set; } = string.Empty;
    public Guid BinId { get; set; }
    public string BinCode { get; set; } = string.Empty;
    public string LotNumber { get; set; } = string.Empty;
    public int SystemQuantity { get; set; }
    public Guid ProductId { get; set; }
    public string SKU { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string ABCClassification { get; set; } = "C";
    public int ScheduledIntervalDays { get; set; }
    public string TargetZone { get; set; } = string.Empty;
    public string PriorityMessage { get; set; } = string.Empty;
}