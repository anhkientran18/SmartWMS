using SmartWMS.Domain.Common;
using System;
using System.Collections.Generic;

namespace SmartWMS.Domain.Entities;

public class OutboundIssue : BaseEntity
{
    // Ô kệ thực hiện bốc dỡ hàng đem đi xuất kho
    public Guid BinId { get; set; }
    public Bin? Bin { get; set; }

    // 🌟 ĐÃ TÍCH HỢP: Khóa ngoại liên kết tới danh mục Khách hàng nhận hàng
    public Guid? CustomerId { get; set; }
    public Customer? Customer { get; set; }

    // 🌟 ĐỒNG BỘ ĐỐI XỨNG: Cầu nối danh sách các mặt hàng nằm trong phiếu xuất (1 - Nhiều)
    public ICollection<OutboundOrderItem> Items { get; set; } = new List<OutboundOrderItem>();
}