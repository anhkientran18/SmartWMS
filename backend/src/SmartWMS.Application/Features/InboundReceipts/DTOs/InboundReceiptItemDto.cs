using System;

namespace SmartWMS.Application.Features.InboundReceipts.DTOs;

public class InboundReceiptItemDto
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty; // Tên sản phẩm để hiển thị lên UI
    public int QuantityExpected { get; set; }
    public int QuantityReceived { get; set; }
    public string LotNumber { get; set; } = string.Empty;
    public DateTime? ExpirationDate { get; set; }
}