using SmartWMS.Domain.Common;

public class Bin : BaseEntity
{
    public string Code { get; set; } = string.Empty;
public Guid ZoneId { get; set; }
public Zone Zone { get; set; } = null!;
public double MaxCapacity { get; set; }
public double CurrentOccupancy { get; set; }
}