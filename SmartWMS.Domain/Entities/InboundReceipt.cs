using SmartWMS.Domain.Common;
using System;
using System.Collections.Generic;

namespace SmartWMS.Domain.Entities;

public class InboundReceipt : BaseEntity
{
    // Ô kệ tiếp nhận lượt hạ hàng
    public Guid BinId { get; set; }
    public Bin? Bin { get; set; }

    // 🌟 ĐÃ TÍCH HỢP: Khóa ngoại liên kết tới danh mục Nhà cung cấp
    public Guid? SupplierId { get; set; }
    public Supplier? Supplier { get; set; }

    // 🌟 QUAN HỆ 1 - NHIỀU: Cầu nối danh sách các mặt hàng nằm trong phiếu nhập
    public ICollection<InboundReceiptItem> Items { get; set; } = new List<InboundReceiptItem>();
}