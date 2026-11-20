using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SmartWMS.Application.Common.Events;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Inventory;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums;

namespace SmartWMS.Infrastructure.Services;

public sealed class InventoryJobService(IApplicationDbContext context, IMediator mediator,
    IInventoryMutationCoordinator coordinator, ILogger<InventoryJobService> logger) : IInventoryJobService
{
    public async Task RunExpiredStockLockJobAsync()
    {
        var now = DateTime.UtcNow;
        long total = 0;
        int affected = 0, skipped = 0;
        await using (var transaction = await coordinator.BeginAsync(CancellationToken.None))
        {
            try
            {
                var candidates = await context.BinInventories.AsNoTracking()
                    .Where(x => x.Status == InventoryStatus.Available && x.ExpirationDate <= now)
                    .OrderBy(x => x.BinId).ThenBy(x => x.ProductId).ThenBy(x => x.LotNumber).ToListAsync();
                foreach (var candidate in candidates)
                {
                    var rows = await coordinator.LockLotAsync(candidate.BinId, candidate.ProductId,
                        InventoryMutationRules.Lot(candidate.LotNumber), CancellationToken.None);
                    var stock = rows.Single(x => x.Id == candidate.Id);
                    if (stock.Status != InventoryStatus.Available || stock.ExpirationDate == null || stock.ExpirationDate > now)
                        continue;
                    if (!InventoryMutationRules.ValidStock(stock) || stock.ReservedQuantity > 0 ||
                        rows.Any(x => x.Id != stock.Id && x.Status == InventoryStatus.Damaged) ||
                        await coordinator.HasWorkflowAsync(stock, CancellationToken.None))
                    {
                        skipped++;
                        logger.LogWarning("Expiry job skipped inventory {InventoryId}: reservation, workflow, invalid quantity or target identity collision.", stock.Id);
                        continue;
                    }
                    var binCode = await context.Bins.Where(x => x.Id == stock.BinId).Select(x => x.Code).SingleAsync();
                    stock.Status = InventoryStatus.Damaged;
                    total += stock.Quantity;
                    affected++;
                    context.InventoryTransactions.Add(new InventoryTransaction { Id = Guid.NewGuid(), ProductId = stock.ProductId,
                        BinInventoryId = stock.Id, TransactionType = "FEFO_AUTO_LOCK", QuantityChanged = -stock.Quantity,
                        SourceBinCode = binCode, DestinationBinCode = "LOCK_ZONE",
                        ReasonCode = $"EXPIRED_DATE_REACHED: {stock.ExpirationDate:yyyy-MM-dd}",
                        CreatedBy = "WMS_FEFO_AutoJob", CreatedAt = DateTime.UtcNow });
                }
                await context.SaveChangesAsync(CancellationToken.None);
                await transaction.CommitAsync(CancellationToken.None);
            }
            catch (Exception ex) when (coordinator.IsConflict(ex))
            {
                await transaction.RollbackAsync();
                logger.LogWarning(ex, "Expiry job COM_409: entire batch rolled back; no success notification. Next scheduled run will query fresh state.");
                return;
            }
        }
        logger.LogInformation("Expiry job committed {Affected} rows ({Quantity} units); skipped {Skipped}.", affected, total, skipped);
        if (affected == 0) return;
        try
        {
            await mediator.Publish(new InventoryChangedEvent { EventType = "QUARANTINE_HOLD",
                Message = $"Hệ thống FEFO đã khóa thành công {total} sản phẩm quá hạn sử dụng." });
        }
        catch (Exception ex) { logger.LogError(ex, "Expiry job committed, but notification failed. Mutation must not be retried."); }
    }
}
