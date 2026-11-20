namespace SmartWMS.Domain.Entities;

public class FulfilmentOperationRequest
{
    public Guid RequestId { get; set; }
    public string OperationKind { get; set; } = string.Empty;
    // allocation:<id>, inbound:<receipt-id>, or wave:<canonical allocation/task-set hash>.
    public string ScopeKey { get; set; } = string.Empty;
    public string? NaturalOperationKey { get; set; }
    public string CanonicalPayload { get; set; } = string.Empty;
    public string PayloadHash { get; set; } = string.Empty;
    public string CompletedResponseJson { get; set; } = string.Empty;
    public string Status { get; set; } = "Completed";
    public Guid? AllocationId { get; set; }
    public OutboundAllocation? Allocation { get; set; }
    public Guid? InboundReceiptId { get; set; }
    public InboundReceipt? InboundReceipt { get; set; }
    public Guid? OrderId { get; set; }
    public OutboundIssue? Order { get; set; }
    public Guid? WaveId { get; set; }
    public Wave? Wave { get; set; }
    public Guid? ShipmentId { get; set; }
    public Shipment? Shipment { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? CreatedBy { get; set; }
    public DateTime CompletedAt { get; set; }
}
