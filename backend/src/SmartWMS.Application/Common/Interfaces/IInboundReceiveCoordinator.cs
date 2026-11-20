using SmartWMS.Domain.Entities;

namespace SmartWMS.Application.Common.Interfaces;

// Used inside the inventory mutation transaction; locks and refreshes persisted evidence.
public interface IInboundReceiveCoordinator
{
    Task<InboundReceipt?> LockReceiptAsync(Guid id, CancellationToken ct);
    Task<Bin?> LockBinAsync(Guid id, CancellationToken ct);
    Task<long> PhysicalQuantityAsync(Guid binId, CancellationToken ct);
    Task<List<BinInventory>> LockLotAsync(Guid binId, Guid productId, string lot, CancellationToken ct);
    Task<bool> HasSerialAsync(Guid inventoryId, CancellationToken ct);
}
