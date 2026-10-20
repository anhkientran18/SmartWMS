using SmartWMS.Domain.Common;

namespace SmartWMS.Domain.Entities;

public class Shipment : BaseEntity
{
    public Guid OrderId { get; set; }
    public OutboundIssue Order { get; set; } = null!;
    public Guid AllocationId { get; set; }
    public OutboundAllocation Allocation { get; set; } = null!;
    public Guid StagingBinId { get; set; }
    public Bin StagingBin { get; set; } = null!;
    public string CanonicalPackingPayload { get; set; } = string.Empty;
    public DateTime ShippedAt { get; set; }
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();
}
