using SmartWMS.Domain.Common;
using System;

namespace SmartWMS.Domain.Entities;

public class CycleCountItem : BaseEntity
{
    // Khóa ngoại liên kết về Phiếu kiểm kê tổng
    public Guid CountSheetId { get; set; }
    public CycleCountSheet CountSheet { get; set; } = null!;

    // Vị trí ô kệ chứa hàng
    public Guid BinId { get; set; }
    public Bin Bin { get; set; } = null!;

    // Sản phẩm cần đếm
    public Guid ProductId { get; set; }
    public Product Product { get; set; } = null!;

    public string LotNumber { get; set; } = string.Empty;

    // Đối chiếu số liệu
    public int SystemQuantity { get; set; } // Số lượng tồn kho ghi nhận trên phần mềm
    public int CountedQuantity { get; set; } // Số lượng thực tế nhân viên đếm được

    // Thuộc tính tính toán chênh lệch
    public int Variance => CountedQuantity - SystemQuantity; // Bổ sung tính toán Variance

    public string Status { get; set; } = "Pending"; // Pending, Matched, Discrepancy
}