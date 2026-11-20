using SmartWMS.Domain.Common;

namespace SmartWMS.Domain.Entities;

public class Wave : BaseEntity
{
    public string WaveCode { get; set; } = string.Empty;
    public Guid WarehouseId { get; set; }
    public Warehouse Warehouse { get; set; } = null!;
    public string Priority { get; set; } = "Normal";
    public string Status { get; set; } = "Created";
    // Canonical membership includes allocation-cycle and task IDs; compare the full set on replay.
    public string CanonicalTaskSet { get; set; } = string.Empty;
    public string TaskSetHash { get; set; } = string.Empty;
    public DateTime? CompletedAt { get; set; }
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();
}
