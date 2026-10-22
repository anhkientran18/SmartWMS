using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Inventory;
using SmartWMS.Domain.Entities;
using SmartWMS.Infrastructure.Persistence.DbContext;

namespace SmartWMS.Infrastructure.Services;

public sealed class InboundReceiveCoordinator(ApplicationDbContext context) : IInboundReceiveCoordinator
{
    public async Task<InboundReceipt?> LockReceiptAsync(Guid id, CancellationToken ct)
    {
        var receipt = await context.InboundReceipts.FromSqlInterpolated($"""
            SELECT * FROM [InboundReceipts] WITH (UPDLOCK, HOLDLOCK) WHERE [Id] = {id}
            """).AsTracking().SingleOrDefaultAsync(ct);
        if (receipt == null) return null;
        await context.Entry(receipt).ReloadAsync(ct);
        var items = await context.InboundReceiptItems.FromSqlInterpolated($"""
            SELECT * FROM [InboundReceiptItems] WITH (UPDLOCK, HOLDLOCK) WHERE [InboundReceiptId] = {id}
            """).AsTracking().ToListAsync(ct);
        foreach (var item in items) await context.Entry(item).ReloadAsync(ct);
        receipt.Items = items;
        return receipt;
    }

    public async Task<Bin?> LockBinAsync(Guid id, CancellationToken ct)
    {
        var bin = await context.Bins.FromSqlInterpolated($"""
            SELECT b.* FROM [Bins] b WITH (UPDLOCK, HOLDLOCK)
            JOIN [Zones] z WITH (HOLDLOCK) ON z.[Id] = b.[ZoneId]
            JOIN [Warehouses] w WITH (HOLDLOCK) ON w.[Id] = z.[WarehouseId]
            WHERE b.[Id] = {id} AND b.[IsDeleted] = 0 AND z.[IsDeleted] = 0 AND w.[IsDeleted] = 0
            """).AsTracking().SingleOrDefaultAsync(ct);
        if (bin != null) await context.Entry(bin).ReloadAsync(ct);
        return bin;
    }

    public Task<long> PhysicalQuantityAsync(Guid binId, CancellationToken ct) =>
        context.Database.SqlQuery<long>($"""
            SELECT COALESCE(SUM(CAST([Quantity] AS bigint)), 0) AS [Value]
            FROM [BinInventories] WITH (HOLDLOCK) WHERE [BinId] = {binId}
            """).SingleAsync(ct);

    public async Task<List<BinInventory>> LockLotAsync(Guid binId, Guid productId, string lot, CancellationToken ct)
    {
        // Read the product's full bin range: SQL LTRIM/RTRIM alone does not normalize tabs/Unicode
        // whitespace like InventoryMutationRules.Lot. Retain absence locks through the commit.
        var rows = await context.BinInventories.FromSqlInterpolated($"""
            SELECT * FROM [BinInventories] WITH (UPDLOCK, HOLDLOCK)
            WHERE [BinId] = {binId} AND [ProductId] = {productId}
            """).AsTracking().ToListAsync(ct);
        foreach (var row in rows) await context.Entry(row).ReloadAsync(ct);
        var matching = new List<BinInventory>();
        foreach (var row in rows)
        {
            var normalized = InventoryMutationRules.Lot(row.LotNumber);
            // Compare normalized values with the same database collation used by the unique key.
            if (normalized == lot || await context.Database.SqlQuery<int>($"""
                SELECT CASE WHEN {normalized} = {lot} THEN 1 ELSE 0 END AS [Value]
                """).SingleAsync(ct) == 1) matching.Add(row);
        }
        return matching;
    }

    public async Task<bool> HasSerialAsync(Guid inventoryId, CancellationToken ct) =>
        await context.Database.SqlQuery<int>($"""
            SELECT CASE WHEN EXISTS (SELECT 1 FROM [ProductSerialNumbers] WITH (HOLDLOCK)
                WHERE [BinInventoryId] = {inventoryId}) THEN 1 ELSE 0 END AS [Value]
            """).SingleAsync(ct) == 1;
}
