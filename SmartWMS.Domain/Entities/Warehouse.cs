using SmartWMS.Domain.Common;
using System.Collections.Generic;

namespace SmartWMS.Domain.Entities;

public class Warehouse : BaseEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;

    // Bổ sung 2 trường còn thiếu để đồng bộ với kiến trúc mới
    public string Address { get; set; } = string.Empty;
    public bool IsDeleted { get; set; } = false;

    public ICollection<Zone> Zones { get; set; } = new HashSet<Zone>();
}