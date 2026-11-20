using System;

namespace SmartWMS.Application.Features.InventoryManagement.DTOs.Queries;

public class StockHistoryDto
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string TransactionType { get; set; } = string.Empty; // Nhập, Xuất, Chuyển, Điều chỉnh
    public int QuantityChanged { get; set; }
    public string SourceBinCode { get; set; } = string.Empty;
    public string DestinationBinCode { get; set; } = string.Empty;
    public string ReasonCode { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public string? CreatedBy { get; set; }
}