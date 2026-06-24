using SmartWMS.Domain.Common;

namespace SmartWMS.Domain.Entities;

public class InventoryCountSheet : BaseEntity
{
    public string CountSheetNumber { get; set; } = string.Empty; // Mã phiếu: PI-202606-001
    public Guid WarehouseId { get; set; }
    public Warehouse Warehouse { get; set; } = null!;

    public string Status { get; set; } = "Draft"; // Draft, Counting, Adjusted, Cancelled
    public string CountedBy { get; set; } = string.Empty;
    public DateTime ScheduledDate { get; set; }

    public ICollection<InventoryCountSheetItem> Items { get; set; } = new List<InventoryCountSheetItem>();
}