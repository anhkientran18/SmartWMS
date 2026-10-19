using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.CycleCounting.Commands.ConfirmCycleCount;

public class ConfirmCycleCountCommandHandler(IApplicationDbContext context)
    : IRequestHandler<ConfirmCycleCountCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(ConfirmCycleCountCommand request, CancellationToken cancellationToken)
    {
        var req = request.RequestData;
        if (req == null || req.CountSheetId == Guid.Empty || req.CountedItems == null || req.CountedItems.Count == 0 ||
            req.CountedItems.Any(x => x == null || x.ItemId == Guid.Empty || !x.CountedQuantity.HasValue || x.CountedQuantity.Value < 0))
            return Invalid("Vui lòng cung cấp phiếu và kết quả kiểm đếm hợp lệ, không âm.");
        if (req.CountedItems.Select(x => x.ItemId).Distinct().Count() != req.CountedItems.Count)
            return Invalid("Không được gửi trùng detail kiểm kê trong cùng request.");

        var sheet = await context.CycleCountSheets.Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.Id == req.CountSheetId && !x.IsDeleted, cancellationToken);
        if (sheet == null) return Invalid("Không tìm thấy phiếu kiểm kê.");
        if (sheet.Status != "Pending" && sheet.Status != "Counting")
            return Invalid("Chỉ được xác nhận phiếu Pending/Counting chưa chốt sổ hoặc hủy.");

        var sheetIds = sheet.Items.Select(x => x.Id).ToHashSet();
        if (req.CountedItems.Any(x => !sheetIds.Contains(x.ItemId)))
            return Invalid("Có detail không thuộc phiếu kiểm kê này.");
        if (sheet.Items.Count == 0 || !sheetIds.SetEquals(req.CountedItems.Select(x => x.ItemId)))
            return Invalid("Phải cung cấp kết quả cho toàn bộ detail trước khi chốt phiếu.");
        if (sheet.Items.GroupBy(x => new { x.BinId, x.ProductId, x.LotNumber }).Any(g => g.Count() != 1))
            return Conflict("Snapshot có nhiều detail cùng Bin/Product/Lot nhưng không lưu status để xác định dòng tồn.");

        var counts = req.CountedItems.ToDictionary(x => x.ItemId, x => x.CountedQuantity!.Value);
        var corrections = new List<(CycleCountItem Item, BinInventory Stock, int Counted, int Difference)>();
        foreach (var item in sheet.Items)
        {
            var matches = await context.BinInventories.Include(x => x.Bin)
                .Where(x => x.BinId == item.BinId && x.ProductId == item.ProductId && x.LotNumber == item.LotNumber)
                .ToListAsync(cancellationToken);
            if (matches.Count != 1)
                return Conflict("Tồn kho snapshot không còn tồn tại hoặc không xác định duy nhất theo Bin/Product/Lot. Cần lập lại phiếu.");

            var stock = matches[0];
            if (stock.Bin == null || stock.Bin.IsDeleted)
                return Conflict("Ô kệ của detail không còn hợp lệ.");
            if (item.SystemQuantity < 0 || stock.Quantity != item.SystemQuantity ||
                stock.CreatedAt > sheet.CreatedAt || stock.LastModifiedAt > sheet.CreatedAt)
                return Conflict("Tồn kho đã thay đổi sau snapshot. Cần lập lại phiếu kiểm kê trước khi xác nhận.");

            // The ledger has no lot/inventory ID. Conservatively reject any later movement for this product/bin,
            // including movements whose net quantity returns to the snapshot value.
            if (await context.InventoryTransactions.AsNoTracking().AnyAsync(t =>
                t.ProductId == item.ProductId && t.CreatedAt >= sheet.CreatedAt &&
                (t.SourceBinCode == stock.Bin.Code || t.DestinationBinCode == stock.Bin.Code), cancellationToken))
                return Conflict("Có giao dịch của sản phẩm tại bin sau snapshot. Cần lập lại phiếu kiểm kê.");

            corrections.Add((item, stock, counts[item.Id], counts[item.Id] - item.SystemQuantity));
        }

        // Validate the aggregate bin change before mutating any stock, detail or ledger entry.
        var binChanges = corrections.GroupBy(x => x.Stock.BinId).Select(g => new
        {
            Bin = g.First().Stock.Bin,
            Difference = g.Sum(x => (long)x.Difference)
        }).ToList();
        foreach (var change in binChanges.Where(x => x.Difference != 0))
        {
            var occupancy = change.Bin.CurrentOccupancy + change.Difference;
            if (occupancy < 0 || (change.Difference > 0 && occupancy > change.Bin.MaxCapacity))
                return Invalid("Correction làm occupancy âm hoặc vượt sức chứa ô kệ.");
        }

        foreach (var correction in corrections)
        {
            correction.Item.CountedQuantity = correction.Counted;
            correction.Item.Status = correction.Difference == 0 ? "Matched" : "Discrepancy";
            if (correction.Difference == 0) continue;

            correction.Stock.Quantity = correction.Counted;
            context.InventoryTransactions.Add(new InventoryTransaction
            {
                Id = Guid.NewGuid(),
                ProductId = correction.Item.ProductId,
                TransactionType = "ADJUSTMENT",
                QuantityChanged = correction.Difference,
                SourceBinCode = correction.Stock.Bin.Code,
                DestinationBinCode = correction.Stock.Bin.Code,
                ReasonCode = $"CYCLE_COUNT_{sheet.SheetNumber}",
                CreatedBy = "WarehouseManager",
                CreatedAt = DateTime.UtcNow
            });
        }
        foreach (var change in binChanges)
            if (change.Difference != 0) change.Bin.CurrentOccupancy += change.Difference;

        sheet.Status = sheet.Items.All(x => x.Status == "Matched" || x.Status == "Discrepancy") ? "Completed" : "Counting";
        if (!string.IsNullOrWhiteSpace(req.Notes)) sheet.Notes = req.Notes;
        try
        {
            await context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict("Tồn kho vừa bị cập nhật bởi thao tác khác. Không chốt phiếu; vui lòng tải lại và kiểm kê lại.");
        }
        return Result<bool>.Success(true, $"Chốt sổ thành công; {corrections.Count(x => x.Difference != 0)} detail có chênh lệch đã được điều chỉnh.");
    }

    private static Result<bool> Invalid(string message) => Result<bool>.Failure(ErrorCodeConstants.ValidationError, message);
    private static Result<bool> Conflict(string message) => Result<bool>.Failure(ErrorCodeConstants.Conflict, message);
}
