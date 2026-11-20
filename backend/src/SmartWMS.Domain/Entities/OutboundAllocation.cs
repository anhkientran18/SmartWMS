using SmartWMS.Domain.Common;

namespace SmartWMS.Domain.Entities;

public class OutboundAllocation : BaseEntity
{
    public bool IsDirectPick { get; set; }
    public Guid OrderId { get; set; }
    public OutboundIssue Order { get; set; } = null!;
    public int Generation { get; set; }
    public bool IsActive { get; set; } = true;
    public string Status { get; set; } = "Active";
    public Guid SourceBinId { get; set; }
    public Bin SourceBin { get; set; } = null!;
    public Guid? StagingBinId { get; set; }
    public Bin? StagingBin { get; set; }
    public DateTime? CompletedAt { get; set; }
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();
}
