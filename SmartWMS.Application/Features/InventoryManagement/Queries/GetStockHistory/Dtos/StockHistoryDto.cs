using System;

namespace SmartWMS.Application.Features.InventoryManagement.Queries.GetStockHistory.Dtos;

public class StockHistoryDto
{
    public Guid Id { get; set; }
    public string SKU { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string TransactionType { get; set; } = string.Empty;
    public int QuantityChanged { get; set; } // Số lượng biến động (Ví dụ: +50, -20)
    public string SourceBinCode { get; set; } = string.Empty;
    public string DestinationBinCode { get; set; } = string.Empty;
    public string ReasonCode { get; set; } = string.Empty;
    public string OperatorName { get; set; } = string.Empty; // Người thực hiện hành động
    public string CreatedAt { get; set; } = string.Empty;
}