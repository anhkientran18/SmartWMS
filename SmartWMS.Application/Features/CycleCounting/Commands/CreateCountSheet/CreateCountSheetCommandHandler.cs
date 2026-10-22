using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Inventory;
using SmartWMS.Application.Common.Models;
using SmartWMS.Domain.Entities;

namespace SmartWMS.Application.Features.CycleCounting.Commands.CreateCountSheet;

public sealed class CreateCountSheetCommandHandler(IApplicationDbContext context,
    IInventoryMutationCoordinator mutations, ICycleCountCoordinator counts)
    : IRequestHandler<CreateCountSheetCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(CreateCountSheetCommand request, CancellationToken ct)
    {
        var req = request.RequestData;
        if (req == null || req.BinId == Guid.Empty || req.ZoneId == Guid.Empty ||
            (!req.BinId.HasValue && !req.ZoneId.HasValue) || req.AssignedUserId == Guid.Empty)
            return Invalid("Phải chọn phạm vi kiểm kê hợp lệ.");
        await using var tx = await mutations.BeginAsync(ct);
        try
        {
            if (req.BinId.HasValue)
            {
                var bin = await counts.LockBinAsync(req.BinId.Value, ct);
                if (bin == null || (req.ZoneId.HasValue && bin.ZoneId != req.ZoneId))
                    return Invalid("Bin/Zone/Warehouse không hợp lệ hoặc không cùng phạm vi.");
            }
            else if (!await context.Zones.AnyAsync(x => x.Id == req.ZoneId && !x.IsDeleted &&
                x.Warehouse != null && !x.Warehouse.IsDeleted, ct))
                return Invalid("Zone/Warehouse không hợp lệ.");
            if (req.AssignedUserId.HasValue && !await context.Users.AnyAsync(x => x.Id == req.AssignedUserId && x.IsActive, ct))
                return Invalid("Nhân viên được phân công không hợp lệ.");
            var stocks = await counts.LockScopeAsync(req.BinId, req.ZoneId, ct);
            if (stocks.Count == 0) return Invalid("Không có tồn kho trong phạm vi kiểm kê.");
            if (stocks.GroupBy(x => (x.BinId, x.ProductId, Lot: InventoryMutationRules.Lot(x.LotNumber))).Any(g => g.Count() != 1))
                return Conflict("Không xác định duy nhất tồn kho theo Bin/Product/Lot.");
            foreach (var stock in stocks.OrderBy(x => x.Id))
            {
                // Match the database collation as well as normalized lot identity.
                var identities = await counts.LockLotAsync(stock.BinId, stock.ProductId, InventoryMutationRules.Lot(stock.LotNumber), ct);
                if (identities.Count != 1 || identities[0].Id != stock.Id)
                    return Conflict("Không xác định duy nhất tồn kho theo Bin/Product/Lot.");
                if (!await CycleCountRules.SupportedAsync(context, mutations, counts, stock, ct))
                    return Invalid("Không hỗ trợ kiểm kê tồn kho Serial/LPN, reservation/workflow hoặc dữ liệu không hợp lệ.");
            }
            var sheet = new CycleCountSheet
            {
                Id = Guid.NewGuid(), SheetNumber = $"CC-{Guid.NewGuid():N}",
                BinId = req.BinId, ZoneId = req.ZoneId, AssignedUserId = req.AssignedUserId,
                Status = "Pending", Notes = req.Notes,
                Items = stocks.Select(stock => new CycleCountItem
                {
                    Id = Guid.NewGuid(), BinId = stock.BinId, ProductId = stock.ProductId,
                    LotNumber = stock.LotNumber, SystemQuantity = stock.Quantity,
                    SnapshotBinInventoryId = stock.Id, SnapshotRowVersion = stock.RowVersion.ToArray(),
                    Status = "Pending"
                }).ToList()
            };
            context.CycleCountSheets.Add(sheet);
            await context.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return Result<Guid>.Success(sheet.Id, "Đã tạo snapshot kiểm kê.");
        }
        catch (Exception ex) when (mutations.IsConflict(ex))
        {
            await tx.RollbackAsync();
            return Conflict("Tồn kho thay đổi đồng thời; hãy lập lại phiếu.");
        }
    }
    private static Result<Guid> Invalid(string message) => Result<Guid>.Failure(ErrorCodeConstants.ValidationError, message);
    private static Result<Guid> Conflict(string message) => Result<Guid>.Failure(ErrorCodeConstants.Conflict, message);
}
