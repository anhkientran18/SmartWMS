using SmartWMS.Domain.Common;
using System;
using System.Collections.Generic;

namespace SmartWMS.Domain.Entities;

public class OutboundIssue : BaseEntity
{
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();
    public string OrderNumber { get; set; } = string.Empty;
    public string Status { get; set; } = "Pending";
    public DateTime ExpectedShipDate { get; set; }
    public string Priority { get; set; } = "Normal";
    public string Notes { get; set; } = string.Empty;

    // 🌟 Bổ sung thuộc tính xóa mềm
    public bool IsDeleted { get; set; } = false;

    public Guid BinId { get; set; }
    public Bin? Bin { get; set; }

    public Guid? CustomerId { get; set; }
    public Customer? Customer { get; set; }

    public ICollection<OutboundOrderItem> Items { get; set; } = new List<OutboundOrderItem>();
}