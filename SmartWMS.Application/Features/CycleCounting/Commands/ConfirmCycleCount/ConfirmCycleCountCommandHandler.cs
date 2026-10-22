using MediatR;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Inventory;
using SmartWMS.Application.Common.Models;
using SmartWMS.Domain.Entities;

namespace SmartWMS.Application.Features.CycleCounting.Commands.ConfirmCycleCount;

public sealed class ConfirmCycleCountCommandHandler(IApplicationDbContext context,
    IInventoryMutationCoordinator mutations, ICycleCountCoordinator counts)
    : IRequestHandler<ConfirmCycleCountCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(ConfirmCycleCountCommand request, CancellationToken ct)
    {
        var req = request.RequestData;
        if (req == null || req.CountSheetId == Guid.Empty || req.CountedItems == null || req.CountedItems.Count == 0 ||
            req.CountedItems.Any(x => x == null || x.ItemId == Guid.Empty || !x.CountedQuantity.HasValue || x.CountedQuantity < 0) ||
            req.CountedItems.Select(x => x.ItemId).Distinct().Count() != req.CountedItems.Count)
            return Invalid("Kết quả kiểm kê phải hợp lệ, không âm và không trùng detail.");
        await using var tx = await mutations.BeginAsync(ct);
        try
        {
            var sheet = await counts.LockSheetAsync(req.CountSheetId, ct);
            if (sheet == null || sheet.IsDeleted) return Invalid("Không tìm thấy phiếu kiểm kê.");
            if (sheet.Status != "Pending" && sheet.Status != "Counting")
                return Conflict("Phiếu đã chốt/hủy; không được xác nhận lại.");
            if (sheet.Items.Count == 0 || !sheet.Items.Select(x => x.Id).ToHashSet().SetEquals(req.CountedItems.Select(x => x.ItemId)))
                return Invalid("Phải cung cấp toàn bộ detail của phiếu đúng một lần.");
            if (sheet.Items.Any(x => x.Status != "Pending" || !x.SnapshotBinInventoryId.HasValue ||
                x.SnapshotRowVersion?.Length != 8 || x.SystemQuantity < 0) ||
                sheet.Items.GroupBy(x => x.SnapshotBinInventoryId).Any(g => g.Count() != 1) ||
                sheet.Items.GroupBy(x => (x.BinId, x.ProductId, Lot: InventoryMutationRules.Lot(x.LotNumber))).Any(g => g.Count() != 1))
                return Conflict("Phiếu thiếu snapshot evidence hoặc identity/detail không hợp lệ; cần lập lại phiếu.");
            var values = req.CountedItems.ToDictionary(x => x.ItemId, x => x.CountedQuantity!.Value);
            var corrections = new List<(CycleCountItem Item, BinInventory Stock, int Counted, long Delta)>();
            foreach (var item in sheet.Items.OrderBy(x => x.BinId).ThenBy(x => x.ProductId).ThenBy(x => x.LotNumber, StringComparer.Ordinal))
            {
                var rows = await counts.LockLotAsync(item.BinId, item.ProductId, InventoryMutationRules.Lot(item.LotNumber), ct);
                if (rows.Count != 1 || rows[0].Id != item.SnapshotBinInventoryId ||
                    !rows[0].RowVersion.SequenceEqual(item.SnapshotRowVersion!) || rows[0].Quantity != item.SystemQuantity ||
                    !string.Equals(rows[0].LotNumber, item.LotNumber, StringComparison.Ordinal))
                    return Conflict("Snapshot identity/RowVersion đã thay đổi; cần lập lại phiếu.");
                var stock = rows[0];
                if (!await CycleCountRules.SupportedAsync(context, mutations, counts, stock, ct))
                    return Invalid("Không hỗ trợ kiểm kê tồn kho Serial/LPN, reservation/workflow hoặc dữ liệu không hợp lệ.");
                var counted = values[item.Id];
                if (counted < stock.ReservedQuantity) return Invalid("Correction không được thấp hơn reservation.");
                corrections.Add((item, stock, counted, (long)counted - item.SystemQuantity));
            }
            var changes = corrections.GroupBy(x => x.Stock.BinId)
                .Select(g => (Bin: g.First().Stock.Bin, Delta: g.Sum(x => x.Delta))).ToList();
            foreach (var change in changes)
                if (!InventoryMutationRules.ValidOccupancy(change.Bin, change.Bin.CurrentOccupancy + change.Delta))
                    return Invalid("Correction làm occupancy không hợp lệ hoặc vượt sức chứa.");
            foreach (var correction in corrections)
            {
                correction.Item.CountedQuantity = correction.Counted;
                correction.Item.Status = correction.Delta == 0 ? "Matched" : "Discrepancy";
                if (correction.Delta == 0) continue;
                correction.Stock.Quantity = correction.Counted;
                context.InventoryTransactions.Add(new InventoryTransaction
                {
                    Id = Guid.NewGuid(), ProductId = correction.Stock.ProductId, BinInventoryId = correction.Stock.Id,
                    TransactionType = "ADJUSTMENT", QuantityChanged = checked((int)correction.Delta),
                    SourceBinCode = correction.Stock.Bin.Code, DestinationBinCode = correction.Stock.Bin.Code,
                    ReasonCode = $"CYCLE_COUNT_{sheet.Id:N}"
                });
            }
            foreach (var change in changes)
                if (change.Delta != 0) change.Bin.CurrentOccupancy += change.Delta;
            sheet.Status = "Completed";
            if (!string.IsNullOrWhiteSpace(req.Notes)) sheet.Notes = req.Notes;
            await context.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return Result<bool>.Success(true, "Đã chốt toàn bộ phiếu kiểm kê.");
        }
        catch (Exception ex) when (mutations.IsConflict(ex))
        {
            await tx.RollbackAsync();
            return Conflict("Xung đột kiểm kê; không có correction được commit. Hãy tải lại.");
        }
    }
    private static Result<bool> Invalid(string message) => Result<bool>.Failure(ErrorCodeConstants.ValidationError, message);
    private static Result<bool> Conflict(string message) => Result<bool>.Failure(ErrorCodeConstants.Conflict, message);
}
