using SmartWMS.Application.Features.InventoryManagement.DTOs.Queries;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.Dashboard.DTOs.Queries;

public class ExecutiveDashboardDto
{
    public WarehouseDashboardDto Warehouse { get; set; } = new();
    public InventorySummaryDto Inventory { get; set; } = new();
    public Dictionary<string, int> InboundReceiptsByStatus { get; set; } = new();
    public Dictionary<string, int> OutboundOrdersByStatus { get; set; } = new();
    public DashboardInsightDto AiInsight { get; set; } = new();
}
