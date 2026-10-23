using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Inventory;
using SmartWMS.Application.Common.Models;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums;

namespace SmartWMS.Application.Features.Kitting.Commands.AssembleKit;

// Request-defined assembly, not a BOM engine. The contract does not select lots:
// require one unambiguous Available row per bin/product rather than choosing First().
public sealed class AssembleKitCommandHandler(IApplicationDbContext db, IInventoryMutationCoordinator mutations,
    IInboundReceiveCoordinator bins, IOutboundCoordinator stocks) : IRequestHandler<AssembleKitCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(AssembleKitCommand request, CancellationToken ct)
    {
        var req = request.RequestData;
        if (req == null || req.KitProductId == Guid.Empty || req.TargetBinId == Guid.Empty || req.AssembleQuantity <= 0 ||
            req.Components == null || req.Components.Count == 0 || req.Components.Any(x => x == null ||
                x.ComponentProductId == Guid.Empty || x.SourceBinId == Guid.Empty || x.QuantityPerKit <= 0 || x.ComponentProductId == req.KitProductId))
            return Invalid("Kit, bin và component hợp lệ là bắt buộc; quantity phải dương, kit không thể là component của chính nó.");

        var requirements = new Dictionary<(Guid Bin, Guid Product), int>();
        foreach (var component in req.Components)
        {
            var key = (component.SourceBinId, component.ComponentProductId);
            var quantity = (long)component.QuantityPerKit * req.AssembleQuantity + requirements.GetValueOrDefault(key);
            if (quantity > int.MaxValue) return Invalid("Tổng component requirement vượt giới hạn integer.");
            requirements[key] = (int)quantity;
        }

        await using var tx = await mutations.BeginAsync(ct);
        try
        {
            var productIds = requirements.Keys.Select(x => x.Product).Append(req.KitProductId).Distinct().ToArray();
            var products = await db.Products.AsNoTracking().Where(x => productIds.Contains(x.Id) && !x.IsDeleted).ToListAsync(ct);
            if (products.Count != productIds.Length || products.Any(x => x.TrackingMode is not (ProductTrackingMode.None or ProductTrackingMode.Lot)))
                return Invalid("Sản phẩm không active hoặc UNSUPPORTED_SERIAL: Kitting chỉ hỗ trợ None/Lot, không Serial.");

            // Same bin ordering as transfers; serialize capacity and protect missing output rows.
            var lockedBins = new Dictionary<Guid, Bin>();
            var rows = new Dictionary<Guid, List<BinInventory>>();
            foreach (var id in requirements.Keys.Select(x => x.Bin).Append(req.TargetBinId).Distinct().OrderBy(x => x))
            {
                var bin = await bins.LockBinAsync(id, ct);
                if (bin == null || !Enum.IsDefined(bin.Purpose) || !InventoryMutationRules.ValidOccupancy(bin, bin.CurrentOccupancy))
                    return Invalid("Hierarchy Bin/Zone/Warehouse hoặc occupancy/capacity không hợp lệ.");
                lockedBins.Add(id, bin);
                rows.Add(id, await stocks.LockStocksAsync(id, ct));
                var physical = await bins.PhysicalQuantityAsync(id, ct);
                if (physical < 0 || physical > 9_007_199_254_740_991L || bin.CurrentOccupancy != physical)
                    return Conflict("Occupancy không khớp physical stock; cần đối soát trước khi Kitting.");
            }

            var plan = new List<(BinInventory Stock, int Quantity)>();
            var deltas = lockedBins.Keys.ToDictionary(x => x, _ => 0L);
            var now = DateTime.UtcNow;
            foreach (var entry in requirements.OrderBy(x => x.Key.Bin).ThenBy(x => x.Key.Product))
            {
                var candidates = rows[entry.Key.Bin].Where(x => x.ProductId == entry.Key.Product && x.Status == InventoryStatus.Available).ToList();
                if (candidates.Count != 1) return Invalid("Không xác định duy nhất component Available theo Bin/Product/Lot/Status; không tự chọn lot.");
                var stock = candidates[0];
                var error = await ValidateStock(stock, products.Single(x => x.Id == stock.ProductId), now, ct);
                if (error != null) return Invalid(error);
                if ((long)stock.Quantity - stock.ReservedQuantity < entry.Value)
                    return Invalid("Component không đủ ATP (Quantity - ReservedQuantity); không consume phần đã reserved.");
                plan.Add((stock, entry.Value));
                deltas[stock.BinId] -= entry.Value;
            }

            var outputs = rows[req.TargetBinId].Where(x => x.ProductId == req.KitProductId && x.Status == InventoryStatus.Available).ToList();
            if (outputs.Count > 1) return Invalid("Kit output Available có nhiều lot; request không xác định duy nhất destination identity.");
            var output = outputs.SingleOrDefault();
            if (output != null)
            {
                var error = await ValidateStock(output, products.Single(x => x.Id == req.KitProductId), now, ct);
                if (error != null) return Invalid(error);
                // Do not merge newly assembled output into an order's reserved/workflow stock.
                if (output.ReservedQuantity != 0 || await mutations.HasWorkflowAsync(output, ct))
                    return Conflict("Kit output có reservation/workflow; không được gộp Kitting output.");
            }
            else
            {
                var lot = $"KIT-{now:yyyyMMdd}";
                // Lock/compare normalized identity with database collation before creating.
                var identity = await bins.LockLotAsync(req.TargetBinId, req.KitProductId, lot, ct);
                if (identity.Any(x => x.Status == InventoryStatus.Available)) return Conflict("Kit output identity đã thay đổi; tải lại dữ liệu.");
                output = new BinInventory { Id = Guid.NewGuid(), BinId = req.TargetBinId, ProductId = req.KitProductId,
                    LotNumber = lot, Status = InventoryStatus.Available };
            }
            var outputQuantity = (long)output.Quantity + req.AssembleQuantity;
            if (outputQuantity > int.MaxValue) return Invalid("Kit output quantity vượt giới hạn integer.");
            deltas[req.TargetBinId] += req.AssembleQuantity;
            foreach (var entry in deltas)
                if (lockedBins[entry.Key].CurrentOccupancy + entry.Value > 9_007_199_254_740_991L ||
                    !InventoryMutationRules.ValidOccupancy(lockedBins[entry.Key], lockedBins[entry.Key].CurrentOccupancy + entry.Value))
                    return Invalid("Projected occupancy sau Kitting âm hoặc vượt capacity; same-bin được tính theo net delta.");

            // All validation complete. Physical changes, occupancy, ledger and audit share one commit.
            var operation = Guid.NewGuid().ToString("N");
            foreach (var entry in plan)
            {
                entry.Stock.Quantity -= entry.Quantity;
                db.InventoryTransactions.Add(new InventoryTransaction { Id = Guid.NewGuid(), ProductId = entry.Stock.ProductId,
                    BinInventoryId = entry.Stock.Id, TransactionType = "KITTING_ISSUE", QuantityChanged = -entry.Quantity,
                    SourceBinCode = lockedBins[entry.Stock.BinId].Code, DestinationBinCode = "PACKING_STATION",
                    ReasonCode = $"KITTING:{operation}:KIT:{req.KitProductId:N}", CreatedAt = now });
            }
            if (!outputs.Any()) db.BinInventories.Add(output);
            output.Quantity = (int)outputQuantity;
            foreach (var entry in deltas) lockedBins[entry.Key].CurrentOccupancy += entry.Value;
            db.InventoryTransactions.Add(new InventoryTransaction { Id = Guid.NewGuid(), ProductId = req.KitProductId,
                BinInventoryId = output.Id, TransactionType = "KITTING_RECEIPT", QuantityChanged = req.AssembleQuantity,
                SourceBinCode = "PACKING_STATION", DestinationBinCode = lockedBins[req.TargetBinId].Code,
                ReasonCode = $"KITTING:{operation}:KIT:{req.KitProductId:N}", CreatedAt = now });
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return Result<bool>.Success(true, $"Đã lắp ráp {req.AssembleQuantity} kit. Operation: {operation}. Request lặp là operation mới; không tự retry.");
        }
        catch (Exception ex) when (stocks.IsConflict(ex))
        {
            await tx.RollbackAsync();
            return Conflict("Xung đột Kitting; đã rollback. Tải lại stock/history trước khi quyết định gửi tiếp, không tự retry.");
        }
    }

    private async Task<string?> ValidateStock(BinInventory stock, Product product, DateTime now, CancellationToken ct)
    {
        if (!InventoryMutationRules.ValidStock(stock) || stock.ExpirationDate <= now ||
            (product.TrackingMode == ProductTrackingMode.Lot && string.IsNullOrWhiteSpace(stock.LotNumber)))
            return "Stock quantity/reservation/lot/expiry không hợp lệ hoặc đã hết hạn.";
        if (!string.IsNullOrEmpty(stock.LpnCode) || await bins.HasSerialAsync(stock.Id, ct))
            return "UNSUPPORTED_LPN_SERIAL: Kitting không hỗ trợ stock có LPN hoặc serial evidence.";
        // Even a single literal row can have ambiguous normalized lot identity.
        var identity = await bins.LockLotAsync(stock.BinId, stock.ProductId, InventoryMutationRules.Lot(stock.LotNumber), ct);
        return identity.Count(x => x.Status == InventoryStatus.Available) == 1 ? null : "Normalized lot identity không duy nhất.";
    }

    private static Result<bool> Invalid(string message) => Result<bool>.Failure(ErrorCodeConstants.ValidationError, message);
    private static Result<bool> Conflict(string message) => Result<bool>.Failure(ErrorCodeConstants.Conflict, message);
}
