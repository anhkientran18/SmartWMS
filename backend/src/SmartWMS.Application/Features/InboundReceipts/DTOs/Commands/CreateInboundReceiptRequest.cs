using System;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.InboundReceipts.DTOs.Commands;

public class CreateInboundReceiptRequest
{
    // PO Number (Purchase Order) hoặc mã phiếu nhập tự sinh
    public string ReceiptNumber { get; set; } = string.Empty;
    public Guid SupplierId { get; set; }
    public Guid BinId { get; set; }
    public DateTime ExpectedDeliveryDate { get; set; }
    public string ReferenceDocument { get; set; } = string.Empty; // Số hóa đơn, chứng từ gốc
    public string Notes { get; set; } = string.Empty;

    // Danh sách mặt hàng (Line Items)
    public List<InboundItemRequest> Items { get; set; } = new();
}

public class InboundItemRequest
{
    public Guid ProductId { get; set; }
    public int ExpectedQuantity { get; set; }
    public string LotNumber { get; set; } = string.Empty;
    public DateTime? ExpirationDate { get; set; } // Hạn dùng (dành cho FEFO)
}