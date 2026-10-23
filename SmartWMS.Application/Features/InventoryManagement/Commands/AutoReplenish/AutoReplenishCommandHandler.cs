using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Inventory;
using SmartWMS.Application.Common.Models;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums;

namespace SmartWMS.Application.Features.InventoryManagement.Commands.AutoReplenish;

// Quantity refill of existing stock rows, not a task/planning engine.
public sealed class AutoReplenishCommandHandler(IApplicationDbContext db, IInventoryMutationCoordinator mutations,
    IInboundReceiveCoordinator bins, IOutboundCoordinator stocks) : IRequestHandler<AutoReplenishCommand, Result<int>>
{
    public async Task<Result<int>> Handle(AutoReplenishCommand request, CancellationToken ct)
    {
        // Discovery is deliberately outside the write transaction. It is only a bounded work list,
        // never authority for quantity/capacity. Every candidate is reloaded/rechecked under locks.
        var discovered = await db.BinInventories.AsNoTracking().Where(x => x.Quantity > 0 && x.Status == InventoryStatus.Available &&
            !x.Bin.IsDeleted && x.Bin.Purpose == BinPurpose.Storage && !x.Bin.Zone!.IsDeleted && !x.Bin.Zone.Warehouse!.IsDeleted &&
            x.Bin.MaxCapacity > 0 && x.Bin.CurrentOccupancy <= x.Bin.MaxCapacity * 0.20).Select(x => new { x.Id, x.BinId, x.ProductId }).ToListAsync(ct);
        if (discovered.Count == 0) return Result<int>.Success(0, "Không có target cần replenishment.");
        var productIds = discovered.Select(x => x.ProductId).Distinct().ToArray();
        var sourceBins = await db.BinInventories.AsNoTracking().Where(x => productIds.Contains(x.ProductId) &&
            x.Status == InventoryStatus.Available && x.Quantity > 0).Select(x => x.BinId).Distinct().ToListAsync(ct);
        var binIds = sourceBins.Concat(discovered.Select(x => x.BinId)).Distinct().OrderBy(x => x).ToArray();
        var targetIds = discovered.Select(x => x.Id).ToHashSet();

        await using var tx = await mutations.BeginAsync(ct);
        try
        {
            var products = await db.Products.AsNoTracking().Where(x => productIds.Contains(x.Id) && !x.IsDeleted &&
                (x.TrackingMode == ProductTrackingMode.None || x.TrackingMode == ProductTrackingMode.Lot)).ToDictionaryAsync(x => x.Id, ct);
            var lockedBins = new Dictionary<Guid, Bin>();
            var warehouses = new Dictionary<Guid, Guid>();
            var allRows = new List<BinInventory>();
            // Deterministic bin locks serialize overlap and aggregate capacity, including other
            // inventory writers that use optimistic bin rowversion instead of these update locks.
            foreach (var id in binIds)
            {
                var bin = await bins.LockBinAsync(id, ct);
                if (bin == null || bin.Purpose != BinPurpose.Storage || !InventoryMutationRules.ValidOccupancy(bin, bin.CurrentOccupancy)) continue;
                var rows = await stocks.LockStocksAsync(id, ct);
                var physical = await bins.PhysicalQuantityAsync(id, ct);
                if (physical < 0 || physical > 9_007_199_254_740_991L || bin.CurrentOccupancy != physical) continue;
                lockedBins.Add(id, bin); allRows.AddRange(rows);
                warehouses.Add(id, await db.Zones.AsNoTracking().Where(x => x.Id == bin.ZoneId).Select(x => x.WarehouseId).SingleAsync(ct));
            }
            var quantities = allRows.ToDictionary(x => x.Id, x => x.Quantity);
            var occupancy = lockedBins.ToDictionary(x => x.Key, x => x.Value.CurrentOccupancy);
            var identities = new Dictionary<(Guid Bin, Guid Product, string Lot), List<BinInventory>>();
            var valid = new Dictionary<Guid, bool>();
            var now = DateTime.UtcNow;
            async Task<bool> Usable(BinInventory row)
            {
                if (valid.TryGetValue(row.Id, out var previous)) return previous;
                var ok = products.TryGetValue(row.ProductId, out var product) && row.Status == InventoryStatus.Available &&
                    InventoryMutationRules.ValidStock(row) && string.IsNullOrEmpty(row.LpnCode) && !(row.ExpirationDate <= now) &&
                    (product.TrackingMode != ProductTrackingMode.Lot || !string.IsNullOrWhiteSpace(row.LotNumber)) &&
                    !await bins.HasSerialAsync(row.Id, ct);
                if (ok)
                {
                    var key = (row.BinId, row.ProductId, InventoryMutationRules.Lot(row.LotNumber));
                    if (!identities.TryGetValue(key, out var rows))
                        identities[key] = rows = await bins.LockLotAsync(row.BinId, row.ProductId, key.Item3, ct);
                    ok = rows.Count(x => x.Status == InventoryStatus.Available) == 1;
                }
                return valid[row.Id] = ok;
            }

            var plan = new List<(BinInventory Source, BinInventory Target, int Quantity)>();
            var recipients = new HashSet<Guid>();
            var donors = new HashSet<Guid>();
            foreach (var target in allRows.Where(x => targetIds.Contains(x.Id)).OrderBy(x => x.BinId).ThenBy(x => x.ProductId)
                .ThenBy(x => InventoryMutationRules.Lot(x.LotNumber), StringComparer.Ordinal).ThenBy(x => x.Id))
            {
                var bin = lockedBins[target.BinId];
                if (donors.Contains(bin.Id) || quantities[target.Id] <= 0 || bin.MaxCapacity <= 0 || occupancy[bin.Id] > bin.MaxCapacity * 0.20 ||
                    !await Usable(target) || target.ReservedQuantity != 0 || await mutations.HasWorkflowAsync(target, ct)) continue;
                var required = Math.Floor(bin.MaxCapacity - occupancy[bin.Id]);
                // Do not clamp, split across sources or silently produce a partial refill.
                if (required <= 0 || required > int.MaxValue || (long)quantities[target.Id] + required > int.MaxValue) continue;
                foreach (var source in allRows.Where(x => x.BinId != bin.Id && x.ProductId == target.ProductId)
                    .OrderBy(x => x.BinId).ThenBy(x => x.Id))
                {
                    if (recipients.Contains(source.BinId) || warehouses[source.BinId] != warehouses[bin.Id] ||
                        (long)quantities[source.Id] - source.ReservedQuantity < required || source.ExpirationDate != target.ExpirationDate ||
                        !await Usable(source)) continue;
                    // Compare lot identity using the database collation/normalization policy.
                    var key = (source.BinId, source.ProductId, InventoryMutationRules.Lot(target.LotNumber));
                    if (!identities.TryGetValue(key, out var identity))
                        identities[key] = identity = await bins.LockLotAsync(source.BinId, source.ProductId, key.Item3, ct);
                    if (identity.Count(x => x.Status == InventoryStatus.Available) != 1 || !identity.Any(x => x.Id == source.Id)) continue;
                    var sourceBin = lockedBins[source.BinId];
                    var nextSourceOccupancy = occupancy[source.BinId] - required;
                    var nextTargetOccupancy = occupancy[bin.Id] + required;
                    if (!InventoryMutationRules.ValidOccupancy(sourceBin, nextSourceOccupancy) ||
                        !InventoryMutationRules.ValidOccupancy(bin, nextTargetOccupancy) || nextTargetOccupancy > 9_007_199_254_740_991L) continue;
                    // Avoid immediate reverse refill on the next run: do not leave a donor with
                    // a positive, unreserved Available row in a newly low bin. Empty/reserved-only
                    // remainders cannot be targets and remain valid exact-ATP cases.
                    if (nextSourceOccupancy <= sourceBin.MaxCapacity * 0.20 && allRows.Any(x => x.BinId == sourceBin.Id &&
                        x.Status == InventoryStatus.Available && x.ReservedQuantity == 0 &&
                        quantities[x.Id] - (x.Id == source.Id ? required : 0) > 0)) continue;
                    var move = (int)required;
                    quantities[source.Id] -= move; quantities[target.Id] += move;
                    occupancy[source.BinId] = nextSourceOccupancy; occupancy[bin.Id] = nextTargetOccupancy;
                    donors.Add(source.BinId); recipients.Add(bin.Id); plan.Add((source, target, move));
                    break;
                }
            }
            if (plan.Count == 0)
            {
                await tx.CommitAsync(ct);
                return Result<int>.Success(0, "Không có movement hợp lệ; thiếu ATP/metadata, Unsupported LPN/Serial, capacity/hierarchy không hợp lệ hoặc donor sẽ thành low-stock.");
            }
            // No refresh/lookup after mutations start: all deltas were validated against one locked state.
            foreach (var row in allRows) row.Quantity = quantities[row.Id];
            foreach (var bin in lockedBins.Values) bin.CurrentOccupancy = occupancy[bin.Id];
            var operation = Guid.NewGuid().ToString("N");
            foreach (var move in plan)
                db.InventoryTransactions.Add(new InventoryTransaction { Id = Guid.NewGuid(), ProductId = move.Source.ProductId,
                    BinInventoryId = move.Source.Id, DestinationBinInventoryId = move.Target.Id, TransactionType = "TRANSFER", QuantityChanged = move.Quantity,
                    SourceBinCode = lockedBins[move.Source.BinId].Code, DestinationBinCode = lockedBins[move.Target.BinId].Code,
                    ReasonCode = $"AUTO_REPLENISHMENT:{operation}:LOT:{move.Source.LotNumber}", CreatedAt = now });
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return Result<int>.Success(plan.Count, $"Đã commit {plan.Count} replenishment movements. Operation: {operation}.");
        }
        catch (Exception ex) when (stocks.IsConflict(ex))
        {
            await tx.RollbackAsync();
            return Result<int>.Failure(ErrorCodeConstants.Conflict, "Replenishment conflict; toàn bộ batch rollback. Đọc lại inventory/history, không tự retry mù.");
        }
    }
}
