using SmartWMS.Domain.Common;
using System;

namespace SmartWMS.Domain.Entities;

public class InboundReceiptItem : BaseEntity
{
    // Khóa ngoại liên kết ngược về Phiếu nhập tổng
    public Guid InboundReceiptId { get; set; }
    public InboundReceipt InboundReceipt { get; set; } = null!;

    // Khóa ngoại liên kết tới Sản phẩm nhập
    public Guid ProductId { get; set; }
    public Product Product { get; set; } = null!;

    // Nghiệp vụ WMS nâng cao: Đối chiếu chênh lệch hàng nhận thực tế
    public int QuantityExpected { get; set; } // Số lượng nhà cung cấp khai báo trên chứng từ
    public int QuantityReceived { get; set; } // Số lượng thực tế nhân viên kiểm đếm khi hạ hàng

    // Đồng bộ thông tin Lô hàng nhập kho
    public string LotNumber { get; set; } = string.Empty;
    public DateTime? ExpirationDate { get; set; }
}