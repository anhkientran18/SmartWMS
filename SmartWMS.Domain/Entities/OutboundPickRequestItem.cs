namespace SmartWMS.Domain.Entities;

public class OutboundPickRequestItem
{
    public Guid RequestId { get; set; }
    public OutboundPickRequest Request { get; set; } = null!;
    public Guid PickTaskId { get; set; }
    public PickTask PickTask { get; set; } = null!;
    // Composite FKs prevent a replay result linking a task from another allocation cycle.
    public Guid AllocationId { get; set; }
    public int QuantityPicked { get; set; }
}
