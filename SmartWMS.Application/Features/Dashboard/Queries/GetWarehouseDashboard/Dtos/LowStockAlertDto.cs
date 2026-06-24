using System;

namespace SmartWMS.Application.Features.Dashboard.Queries.GetWarehouseDashboard.Dtos;

public class LowStockAlertDto
{
    public Guid ProductId { get; set; }
    public string SKU { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public int CurrentStock { get; set; }
}