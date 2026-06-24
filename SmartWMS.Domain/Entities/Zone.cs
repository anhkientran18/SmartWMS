using SmartWMS.Domain.Common;
using SmartWMS.Domain.Entities;

public class Zone : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public Guid WarehouseId { get; set; }
    public Warehouse Warehouse { get; set; } = null!;
    public ICollection<Bin> Bins { get; set; } = new HashSet<Bin>();
}