using System;

namespace SmartWMS.Application.Features.InventoryManagement.DTOs.Commands;

public class AdjustStockRequest
{
    public Guid BinId { get; set; }
    public Guid ProductId { get; set; }
    public string LotNumber { get; set; } = string.Empty;
    public int AdjustmentQuantity { get; set; } // Số âm (trừ đi) hoặc Số dương (cộng vào)
    public string ReasonCode { get; set; } = string.Empty; // Lý do: Hư hỏng, Sai lệch...
}