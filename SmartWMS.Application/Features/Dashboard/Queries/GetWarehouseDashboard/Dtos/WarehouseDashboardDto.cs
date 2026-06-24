using System.Collections.Generic;

namespace SmartWMS.Application.Features.Dashboard.Queries.GetWarehouseDashboard.Dtos;

public class WarehouseDashboardDto
{
    public int TotalProducts { get; set; }
    public int TotalActiveBins { get; set; }
    public double GlobalOccupancyRate { get; set; } // Tỷ lệ lấp đầy tổng kho (%)

    // Tích hợp danh sách các DTO con đã tách biệt
    public List<LowStockAlertDto> LowStockAlerts { get; set; } = new();
    public List<RecentTransactionDto> RecentTransactions { get; set; } = new();
}