using System;

namespace SmartWMS.Application.Features.Dashboard.Queries.GetWarehouseDashboard.Dtos;

public class RecentTransactionDto
{
    public string SKU { get; set; } = string.Empty;
    public string TransactionType { get; set; } = string.Empty; // Nhập kho / Xuất kho / Dịch chuyển
    public int QuantityChanged { get; set; }
    public string Location { get; set; } = string.Empty; // Ô kệ phát sinh biến động
    public DateTime CreatedAt { get; set; }
}