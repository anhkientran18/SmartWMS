using System.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Domain.Entities;
using SmartWMS.Infrastructure.Persistence.DbContext;

namespace SmartWMS.Infrastructure.Services;

public sealed class InventoryMutationCoordinator(ApplicationDbContext context) : IInventoryMutationCoordinator
{
    public async Task<IInventoryMutationTransaction> BeginAsync(CancellationToken ct)
    {
        // Retain product/hierarchy reads; range locks below protect only absence-sensitive predicates.
        var transaction = await context.Database.BeginTransactionAsync(IsolationLevel.RepeatableRead, ct);
        return new MutationTransaction(context, transaction);
    }

    public Task<List<BinInventory>> LockLotAsync(Guid binId, Guid productId, string lot, CancellationToken ct) =>
        context.BinInventories.FromSqlInterpolated($"""
            SELECT * FROM [BinInventories] WITH (UPDLOCK, HOLDLOCK)
            WHERE [BinId] = {binId} AND [ProductId] = {productId}
              AND COALESCE(NULLIF(LTRIM(RTRIM([LotNumber])), N''), N'LOT-DEFAULT') = {lot}
            """).AsTracking().ToListAsync(ct);

    public async Task<bool> HasWorkflowAsync(BinInventory stock, CancellationToken ct)
    {
        // Hints also cover empty ranges: a concurrent reference insert cannot slip between guard and commit.
        // Terminal labels alone are not trusted when quantities still show outstanding work.
        var value = await context.Database.SqlQuery<int>($"""
            SELECT CASE WHEN
              EXISTS (SELECT 1 FROM [InventoryReservations] r WITH (HOLDLOCK)
                WHERE (r.[SourceBinInventoryId] = {stock.Id} OR r.[StagingBinInventoryId] = {stock.Id})
                AND (r.[Status] NOT IN (N'Shipped', N'Released')
                  OR CAST(r.[Quantity] AS bigint) > CAST(r.[ShippedQuantity] AS bigint) + r.[ReleasedQuantity]))
              OR EXISTS (SELECT 1 FROM [PickTasks] p WITH (HOLDLOCK)
                JOIN [InventoryReservations] r WITH (HOLDLOCK) ON r.[Id] = p.[ReservationId]
                WHERE (r.[SourceBinInventoryId] = {stock.Id} OR r.[StagingBinInventoryId] = {stock.Id})
                  AND p.[Status] NOT IN (N'Completed', N'Released'))
              OR EXISTS (SELECT 1 FROM [WavePickTasks] w WITH (HOLDLOCK)
                JOIN [PickTasks] p WITH (HOLDLOCK) ON p.[Id] = w.[PickTaskId]
                JOIN [InventoryReservations] r WITH (HOLDLOCK) ON r.[Id] = p.[ReservationId]
                WHERE w.[IsActive] = 1
                  AND (r.[SourceBinInventoryId] = {stock.Id} OR r.[StagingBinInventoryId] = {stock.Id}))
              OR EXISTS (SELECT 1 FROM [OutboundAllocations] a WITH (HOLDLOCK)
                JOIN [OutboundOrderItems] i WITH (HOLDLOCK) ON i.[OrderId] = a.[OrderId]
                WHERE a.[IsActive] = 1 AND i.[ProductId] = {stock.ProductId}
                  AND (a.[SourceBinId] = {stock.BinId} OR a.[StagingBinId] = {stock.BinId}))
              THEN 1 ELSE 0 END AS [Value]
            """).SingleAsync(ct);
        return value == 1;
    }

    public bool IsConflict(Exception exception)
    {
        // EF's non-retrying SQL strategy can wrap transient SQL errors in InvalidOperationException.
        for (Exception? current = exception; current != null; current = current.InnerException)
        {
            if (current is DbUpdateConcurrencyException) return true;
            if (current is SqlException sql && sql.Errors.Cast<SqlError>().Any(e =>
                e.Number is 1205 or 1222 || // Deadlock/lock timeout: conflict, never replay.
                (e.Number is 2601 or 2627 &&
                 e.Message.Contains("IX_BinInventories_BinId_ProductId_LotNumber_Status", StringComparison.Ordinal))))
                return true;
        }
        return false;
    }

    private sealed class MutationTransaction(ApplicationDbContext context, IDbContextTransaction transaction)
        : IInventoryMutationTransaction
    {
        private bool finished;

        public async Task CommitAsync(CancellationToken ct)
        {
            await transaction.CommitAsync(ct);
            finished = true;
        }

        public async Task RollbackAsync()
        {
            if (finished) return;
            try
            {
                // SQL Server may already have rolled back a deadlock victim.
                if (transaction.GetDbTransaction().Connection != null)
                    await transaction.RollbackAsync(CancellationToken.None);
            }
            finally
            {
                context.ChangeTracker.Clear();
                finished = true;
            }
        }

        public async ValueTask DisposeAsync()
        {
            try { await RollbackAsync(); }
            finally { await transaction.DisposeAsync(); }
        }
    }
}
