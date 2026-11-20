namespace SmartWMS.Application.Features.InventoryManagement.DTOs.Queries;

public class InventorySummaryDto
{
    public int TotalProducts { get; set; }
    public long TotalQuantity { get; set; }
    public int LowStockItems { get; set; }
}
