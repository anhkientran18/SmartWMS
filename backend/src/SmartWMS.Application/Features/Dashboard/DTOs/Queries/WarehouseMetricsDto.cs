namespace SmartWMS.Application.Features.Dashboard.DTOs.Queries;

public class WarehouseMetricsDto
{
    public int TotalProducts { get; set; }
    public int PendingInboundReceipts { get; set; }
    public int PendingOutboundOrders { get; set; }
    public int ActiveCycleCountSheets { get; set; }
}