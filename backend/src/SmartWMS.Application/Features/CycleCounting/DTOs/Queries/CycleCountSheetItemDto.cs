using System;

namespace SmartWMS.Application.Features.CycleCounting.DTOs.Queries;

public class CycleCountSheetItemDto
{
    public Guid Id { get; set; }
    public Guid BinId { get; set; }
    public string BinCode { get; set; } = string.Empty;
    public string LotNumber { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public Guid ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string SKU { get; set; } = string.Empty;
    public int SystemQuantity { get; set; }
    public int? CountedQuantity { get; set; }
    public int? Variance { get; set; }
}