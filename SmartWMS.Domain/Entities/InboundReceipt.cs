using SmartWMS.Domain.Common;
using System;
using System.Collections.Generic;

namespace SmartWMS.Domain.Entities;

public class InboundReceipt : BaseEntity
{
    public string ReceiptNumber { get; set; } = string.Empty;
    public string Status { get; set; } = "Pending";
    public DateTime ExpectedDeliveryDate { get; set; }
    public string ReferenceDocument { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;

    public Guid? SupplierId { get; set; }
    public Supplier? Supplier { get; set; }

    public Guid? BinId { get; set; }
    public Bin? Bin { get; set; }

    // 🌟 Bổ sung thuộc tính xóa mềm
    public bool IsDeleted { get; set; } = false;

    public ICollection<InboundReceiptItem> Items { get; set; } = new List<InboundReceiptItem>();
}