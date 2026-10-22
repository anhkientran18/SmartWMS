using SmartWMS.Domain.Entities;

namespace SmartWMS.Application.Common.Interfaces;

public interface IOutboundCoordinator
{
    Task<OutboundIssue?> LockOrderAsync(Guid id, CancellationToken ct);
    Task<List<OutboundAllocation>> LockAllocationsAsync(Guid orderId, CancellationToken ct);
    Task<List<InventoryReservation>> LockReservationsAsync(Guid orderId, CancellationToken ct);
    Task<List<BinInventory>> LockStocksAsync(Guid binId, CancellationToken ct);
    bool IsConflict(Exception ex);
}
