using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Events;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Inventory;
using SmartWMS.Application.Common.Models;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums;

namespace SmartWMS.Application.Features.InventoryManagement.Commands.ChangeStockStatus;

public sealed class ChangeStockStatusCommandHandler(IApplicationDbContext context, IInventoryMutationCoordinator coordinator,
    IMediator mediator, ILogger<ChangeStockStatusCommandHandler> logger)
    : IRequestHandler<ChangeStockStatusCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(ChangeStockStatusCommand request, CancellationToken ct)
    {
        var req = request.RequestData;
        if (req == null || !Enum.IsDefined(req.NewStatus))
            return Result<bool>.Failure(ErrorCodeConstants.ValidationError, "Trạng thái không hợp lệ.");
        InventoryChangedEvent? notification = null;
        await using (var transaction = await coordinator.BeginAsync(ct))
        {
            try
            {
                var rows = await coordinator.LockLotAsync(req.BinId, req.ProductId, InventoryMutationRules.Lot(req.LotNumber), ct);
                if (rows.Count > 1 && rows.Any(x => x.Status == req.NewStatus))
                    return Result<bool>.Failure(ErrorCodeConstants.Conflict, "Target status row đã tồn tại; không thể chọn/gộp tồn kho.");
                if (rows.Count != 1)
                    return Result<bool>.Failure(ErrorCodeConstants.ValidationError, "Không xác định duy nhất tồn kho theo Lot/Status.");
                var stock = rows[0];
                if (stock.Status == req.NewStatus)
                {
                    await transaction.CommitAsync(ct);
                    return Result<bool>.Success(true, "Trạng thái không thay đổi.");
                }
                if (req.NewStatus == InventoryStatus.Reserved || !InventoryMutationRules.ValidStock(stock) ||
                    stock.ReservedQuantity > 0 || await coordinator.HasWorkflowAsync(stock, ct))
                    return Result<bool>.Failure(ErrorCodeConstants.Conflict, "Không thể đổi trạng thái khi có reservation/workflow hoặc chuyển sang Reserved.");
                var binCode = await context.Bins.Where(x => x.Id == stock.BinId).Select(x => x.Code).SingleAsync(ct);
                var oldStatus = stock.Status;
                stock.Status = req.NewStatus;
                context.InventoryTransactions.Add(new InventoryTransaction { Id = Guid.NewGuid(), ProductId = stock.ProductId,
                    BinInventoryId = stock.Id, TransactionType = "STATUS_CHANGE", QuantityChanged = 0,
                    SourceBinCode = binCode, DestinationBinCode = binCode,
                    ReasonCode = $"[{oldStatus} -> {req.NewStatus.ToString().ToUpperInvariant()}] {req.ReasonCode}",
                    CreatedBy = "WarehouseManager", CreatedAt = DateTime.UtcNow });
                await context.SaveChangesAsync(ct);
                await transaction.CommitAsync(ct);
                if (req.NewStatus is InventoryStatus.QCHold or InventoryStatus.Damaged)
                    notification = new InventoryChangedEvent { EventType = "STOCK_QC_HOLD",
                        Message = $"Đã chuyển {stock.Quantity} sản phẩm tại kệ {binCode} sang {req.NewStatus}. Lý do: {req.ReasonCode}" };
            }
            catch (Exception ex) when (coordinator.IsConflict(ex))
            {
                await transaction.RollbackAsync();
                return Result<bool>.Failure(ErrorCodeConstants.Conflict, "Tồn kho đã thay đổi đồng thời; hãy tải lại dữ liệu.");
            }
        }
        if (notification != null)
        {
            try { await mediator.Publish(notification, ct); }
            catch (Exception ex) { logger.LogError(ex, "Status change committed, but notification failed. Mutation must not be retried."); }
        }
        return Result<bool>.Success(true, "Đã chuyển trạng thái thành công.");
    }
}
