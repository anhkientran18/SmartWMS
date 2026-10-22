using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Domain.Entities;
using SmartWMS.Infrastructure.Persistence.DbContext;

namespace SmartWMS.Infrastructure.Services;

public sealed class CycleCountCoordinator(ApplicationDbContext context) : ICycleCountCoordinator
{
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

    public async Task<List<BinInventory>> LockScopeAsync(Guid? binId, Guid? zoneId, CancellationToken ct)
    {
        var rows = await context.BinInventories.FromSqlInterpolated($"""
            SELECT i.* FROM [BinInventories] i WITH (UPDLOCK, HOLDLOCK)
            JOIN [Bins] b WITH (HOLDLOCK) ON b.[Id] = i.[BinId]
            WHERE ({binId} IS NOT NULL AND i.[BinId] = {binId})
               OR ({binId} IS NULL AND b.[ZoneId] = {zoneId})
            """).AsTracking().ToListAsync(ct);
        foreach (var row in rows) await context.Entry(row).ReloadAsync(ct);
        return rows;
    }

    public async Task<List<BinInventory>> LockLotAsync(Guid binId, Guid productId, string lot, CancellationToken ct)
    {
        var rows = await new InventoryMutationCoordinator(context).LockLotAsync(binId, productId, lot, ct);
        // A tracking query otherwise returns an old instance from the identity map.
        foreach (var row in rows) await context.Entry(row).ReloadAsync(ct);
        return rows;
    }

    public async Task<CycleCountSheet?> LockSheetAsync(Guid id, CancellationToken ct)
    {
        var sheet = await context.CycleCountSheets.FromSqlInterpolated($"""
            SELECT * FROM [CycleCountSheets] WITH (UPDLOCK, HOLDLOCK) WHERE [Id] = {id}
            """).AsTracking().SingleOrDefaultAsync(ct);
        if (sheet != null)
        {
            await context.Entry(sheet).ReloadAsync(ct);
            var items = await context.CycleCountItems.FromSqlInterpolated($"""
                SELECT * FROM [CycleCountItems] WITH (UPDLOCK, HOLDLOCK) WHERE [CountSheetId] = {id}
                """).AsTracking().ToListAsync(ct);
            foreach (var item in items) await context.Entry(item).ReloadAsync(ct);
            sheet.Items = items;
        }
        return sheet;
    }

    public async Task<bool> HasSerialAsync(Guid inventoryId, CancellationToken ct) =>
        await context.Database.SqlQuery<int>($"""
            SELECT CASE WHEN EXISTS (SELECT 1 FROM [ProductSerialNumbers] WITH (HOLDLOCK)
                WHERE [BinInventoryId] = {inventoryId}) THEN 1 ELSE 0 END AS [Value]
            """).SingleAsync(ct) == 1;
}
