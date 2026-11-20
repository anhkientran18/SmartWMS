using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Domain.Entities;
using SmartWMS.Infrastructure.Persistence.DbContext;

namespace SmartWMS.Infrastructure.Services;

public sealed class OutboundCoordinator(ApplicationDbContext db, IInventoryMutationCoordinator mutations) : IOutboundCoordinator
{
    public async Task<OutboundIssue?> LockOrderAsync(Guid id, CancellationToken ct)
    {
        var order = await db.OutboundIssues.FromSqlInterpolated($"SELECT * FROM [OutboundIssues] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={id}")
            .AsTracking().SingleOrDefaultAsync(ct);
        if (order == null) return null;
        await db.Entry(order).ReloadAsync(ct);
        var items = await db.OutboundOrderItems.FromSqlInterpolated($"SELECT * FROM [OutboundOrderItems] WITH (UPDLOCK,HOLDLOCK) WHERE [OrderId]={id}")
            .AsTracking().ToListAsync(ct);
        foreach (var item in items) await db.Entry(item).ReloadAsync(ct);
        order.Items = items;
        return order;
    }

    public async Task<List<OutboundAllocation>> LockAllocationsAsync(Guid orderId, CancellationToken ct)
    {
        var rows = await db.OutboundAllocations.FromSqlInterpolated($"SELECT * FROM [OutboundAllocations] WITH (UPDLOCK,HOLDLOCK) WHERE [OrderId]={orderId}").AsTracking().ToListAsync(ct);
        foreach (var row in rows) await db.Entry(row).ReloadAsync(ct);
        return rows;
    }

    public async Task<List<InventoryReservation>> LockReservationsAsync(Guid orderId, CancellationToken ct)
    {
        var rows = await db.InventoryReservations.FromSqlInterpolated($"SELECT * FROM [InventoryReservations] WITH (UPDLOCK,HOLDLOCK) WHERE [OrderId]={orderId}").AsTracking().ToListAsync(ct);
        foreach (var row in rows) await db.Entry(row).ReloadAsync(ct);
        return rows;
    }

    public async Task<List<BinInventory>> LockStocksAsync(Guid binId, CancellationToken ct)
    {
        var rows = await db.BinInventories.FromSqlInterpolated($"SELECT * FROM [BinInventories] WITH (UPDLOCK,HOLDLOCK) WHERE [BinId]={binId}").AsTracking().ToListAsync(ct);
        foreach (var row in rows) await db.Entry(row).ReloadAsync(ct);
        return rows;
    }

    public bool IsConflict(Exception ex)
    {
        if (mutations.IsConflict(ex)) return true;
        for (Exception? current = ex; current != null; current = current.InnerException)
            if (current is SqlException sql && sql.Errors.Cast<SqlError>().Any(x => x.Number == -2 ||
                (x.Number is 2601 or 2627 && x.Message.Contains("OutboundAllocations", StringComparison.Ordinal)))) return true;
        return false;
    }
}
