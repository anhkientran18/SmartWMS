using SmartWMS.Domain.Entities;

namespace SmartWMS.Application.Common.Interfaces;

public interface ICycleCountCoordinator
{
    Task<List<BinInventory>> LockScopeAsync(Guid? binId, Guid? zoneId, CancellationToken ct);
    Task<List<BinInventory>> LockLotAsync(Guid binId, Guid productId, string lot, CancellationToken ct);
    Task<Bin?> LockBinAsync(Guid id, CancellationToken ct);
    Task<CycleCountSheet?> LockSheetAsync(Guid id, CancellationToken ct);
    Task<bool> HasSerialAsync(Guid inventoryId, CancellationToken ct);
}
