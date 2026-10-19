using System;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.InboundReceipts.DTOs;

public class InboundReceiptDto
{
    public Guid Id { get; set; }
    public string ReceiptNumber { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime ExpectedDeliveryDate { get; set; }
    public string ReferenceDocument { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;

    // Các thuộc tính bổ sung để sửa lỗi CS0117
    public Guid? BinId { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? CreatedBy { get; set; }

    public Guid? SupplierId { get; set; }
    public string SupplierName { get; set; } = string.Empty;

    public List<InboundReceiptItemDto> Items { get; set; } = new();
}