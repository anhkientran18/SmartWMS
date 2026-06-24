using SmartWMS.Domain.Common;

namespace SmartWMS.Domain.Entities; // Kiểm tra namespace của bạn

public class Warehouse : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty; // Thêm dòng này
    public string? Address { get; set; }
    public ICollection<Zone> Zones { get; set; } = new HashSet<Zone>();
}