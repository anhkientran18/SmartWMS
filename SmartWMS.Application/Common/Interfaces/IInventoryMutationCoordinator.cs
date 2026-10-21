using SmartWMS.Domain.Entities;

namespace SmartWMS.Application.Common.Interfaces;

// SQL locking is limited to the identity and workflow predicates of Phase 4A.
public interface IInventoryMutationCoordinator
{
    Task<IInventoryMutationTransaction> BeginAsync(CancellationToken ct);
    Task<List<BinInventory>> LockLotAsync(Guid binId, Guid productId, string lot, CancellationToken ct);
    Task<bool> HasWorkflowAsync(BinInventory stock, CancellationToken ct);
    bool IsConflict(Exception exception);
}

public interface IInventoryMutationTransaction : IAsyncDisposable
{
    Task CommitAsync(CancellationToken ct);
    Task RollbackAsync();
}
