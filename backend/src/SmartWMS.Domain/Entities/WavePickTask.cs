namespace SmartWMS.Domain.Entities;

public class WavePickTask
{
    public Guid WaveId { get; set; }
    public Wave Wave { get; set; } = null!;
    public Guid PickTaskId { get; set; }
    public PickTask PickTask { get; set; } = null!;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? CreatedBy { get; set; }
    public DateTime? RemovedAt { get; set; }
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();
}
