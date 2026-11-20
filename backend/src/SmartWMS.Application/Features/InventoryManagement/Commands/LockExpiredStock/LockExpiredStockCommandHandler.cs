using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Inventory;
using SmartWMS.Application.Common.Models;
using SmartWMS.Domain.Enums;

namespace SmartWMS.Application.Features.InventoryManagement.Commands.LockExpiredStock;

public sealed class LockExpiredStockCommandHandler(IApplicationDbContext context,
    ILogger<LockExpiredStockCommandHandler> logger, IInventoryMutationCoordinator coordinator)
    : IRequestHandler<LockExpiredStockCommand, Result<int>>
{
    public async Task<Result<int>> Handle(LockExpiredStockCommand request, CancellationToken ct)
    {
        var threshold = DateTime.UtcNow.AddDays(30);
        int affected = 0, skipped = 0;
        await using (var transaction = await coordinator.BeginAsync(ct))
        {
            try
            {
                var candidates = await context.BinInventories.AsNoTracking()
                    .Where(x => x.Status == InventoryStatus.Available && x.ExpirationDate != null && x.ExpirationDate <= threshold)
                    .OrderBy(x => x.BinId).ThenBy(x => x.ProductId).ThenBy(x => x.LotNumber).ToListAsync(ct);
                foreach (var candidate in candidates)
                {
                    var rows = await coordinator.LockLotAsync(candidate.BinId, candidate.ProductId,
                        InventoryMutationRules.Lot(candidate.LotNumber), ct);
                    var stock = rows.Single(x => x.Id == candidate.Id);
                    if (stock.Status != InventoryStatus.Available || stock.ExpirationDate == null || stock.ExpirationDate > threshold)
                        continue;
                    if (!InventoryMutationRules.ValidStock(stock) || stock.ReservedQuantity > 0 ||
                        rows.Any(x => x.Id != stock.Id && x.Status == InventoryStatus.Expired) ||
                        await coordinator.HasWorkflowAsync(stock, ct))
                    {
                        skipped++;
                        logger.LogWarning("Expiry command skipped inventory {InventoryId}: reservation, workflow, invalid quantity or target identity collision.", stock.Id);
                        continue;
                    }
                    stock.Status = InventoryStatus.Expired;
                    affected++;
                }
                await context.SaveChangesAsync(ct);
                await transaction.CommitAsync(ct);
            }
            catch (Exception ex) when (coordinator.IsConflict(ex))
            {
                await transaction.RollbackAsync();
                logger.LogWarning(ex, "Expiry command batch rolled back; no inventory changes committed.");
                return Result<int>.Failure(ErrorCodeConstants.Conflict, "Batch expiry đã rollback do xung đột; không có thay đổi được commit.");
            }
        }
        logger.LogInformation("Expiry command committed {Affected} inventory rows; skipped {Skipped}.", affected, skipped);
        return Result<int>.Success(affected, $"Đã khóa {affected} lô hàng; bỏ qua {skipped} lô hàng.");
    }
}
