using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Inventory;
using SmartWMS.Application.Common.Models;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums;

namespace SmartWMS.Application.Features.InventoryManagement.Commands.AdjustStock;

public sealed class AdjustStockCommandHandler(IApplicationDbContext context, IInventoryMutationCoordinator coordinator)
    : IRequestHandler<AdjustStockCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(AdjustStockCommand request, CancellationToken ct)
    {
        var req = request.RequestData;
        if (req == null || req.AdjustmentQuantity == 0) return Invalid("Số lượng điều chỉnh phải khác 0.");
        await using var transaction = await coordinator.BeginAsync(ct);
        try
        {
            var product = await context.Products.AsNoTracking().SingleOrDefaultAsync(x => x.Id == req.ProductId && !x.IsDeleted, ct);
            if (product == null || product.TrackingMode == ProductTrackingMode.Serial)
                return Invalid("Sản phẩm không hợp lệ hoặc cần serial reconciliation.");
            var bin = await InventoryMutationRules.ValidBinAsync(context, req.BinId, ct);
            if (bin == null) return Invalid("Hierarchy Bin/Zone/Warehouse không hợp lệ.");
            var lot = InventoryMutationRules.Lot(req.LotNumber);
            var rows = await coordinator.LockLotAsync(req.BinId, req.ProductId, lot, ct);
            if (rows.Count > 1) return Invalid("Lookup tồn kho mơ hồ theo Lot/Status; không thể tự chọn một dòng.");
            var stock = rows.SingleOrDefault();
            if (stock != null && !InventoryMutationRules.ValidStock(stock)) return Invalid("Tồn kho/reservation không hợp lệ.");
            long next = (long)(stock?.Quantity ?? 0) + req.AdjustmentQuantity;
            double occupancy = bin.CurrentOccupancy + req.AdjustmentQuantity;
            if (next < (stock?.ReservedQuantity ?? 0) || next > int.MaxValue ||
                !InventoryMutationRules.ValidOccupancy(bin, occupancy))
                return Invalid("Điều chỉnh vi phạm reservation, giới hạn số lượng hoặc sức chứa/occupancy.");
            if (stock == null)
            {
                stock = new BinInventory { Id = Guid.NewGuid(), BinId = req.BinId, ProductId = req.ProductId,
                    LotNumber = lot, Status = InventoryStatus.Available };
                context.BinInventories.Add(stock);
            }
            stock.Quantity = (int)next;
            bin.CurrentOccupancy = occupancy;
            context.InventoryTransactions.Add(new InventoryTransaction { Id = Guid.NewGuid(), ProductId = req.ProductId,
                BinInventoryId = stock.Id, TransactionType = "ADJUSTMENT", QuantityChanged = req.AdjustmentQuantity,
                SourceBinCode = req.AdjustmentQuantity < 0 ? bin.Code : "N/A",
                DestinationBinCode = req.AdjustmentQuantity > 0 ? bin.Code : "N/A",
                ReasonCode = req.ReasonCode, CreatedBy = "WarehouseManager", CreatedAt = DateTime.UtcNow });
            await context.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return Result<bool>.Success(true, "Điều chỉnh tồn kho thành công.");
        }
        catch (Exception ex) when (coordinator.IsConflict(ex))
        {
            await transaction.RollbackAsync();
            return Result<bool>.Failure(ErrorCodeConstants.Conflict, "Tồn kho đã thay đổi đồng thời; hãy tải lại dữ liệu.");
        }
    }
    private static Result<bool> Invalid(string message) => Result<bool>.Failure(ErrorCodeConstants.ValidationError, message);
}
