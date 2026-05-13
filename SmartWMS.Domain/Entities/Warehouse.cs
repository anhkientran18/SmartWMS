using SmartWMS.Domain.Common;

public class Warehouse : BaseEntity
{
    public string Name { get; set; } = string.Empty;
public string? Address { get; set; }
public ICollection<Zone> Zones { get; set; } = new HashSet<Zone>();
}