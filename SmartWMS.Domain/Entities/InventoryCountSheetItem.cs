using SmartWMS.Domain.Common;

namespace SmartWMS.Domain.Entities;

public class InventoryCountSheetItem : BaseEntity
{
    public Guid InventoryCountSheetId { get; set; }
    public InventoryCountSheet InventoryCountSheet { get; set; } = null!;

    public Guid BinId { get; set; }
    public Bin Bin { get; set; } = null!;

    public Guid ProductId { get; set; }
    public Product Product { get; set; } = null!;

    public int SystemQuantity { get; set; }  // Số lượng máy tính đang báo
    public int PhysicalQuantity { get; set; } // Số lượng thực tế nhân viên đếm được
    public int Discrepancy => PhysicalQuantity - SystemQuantity; // Chênh lệch thừa/thiếu
}