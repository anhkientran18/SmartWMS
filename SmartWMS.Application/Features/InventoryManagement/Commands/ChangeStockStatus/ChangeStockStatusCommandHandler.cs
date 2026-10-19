using MediatR;
using SmartWMS.Application.Common.Events;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InventoryManagement.Specifications.Commands;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.InventoryManagement.Commands.ChangeStockStatus;

public class ChangeStockStatusCommandHandler : IRequestHandler<ChangeStockStatusCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMediator _mediator;

    public ChangeStockStatusCommandHandler(IUnitOfWork unitOfWork, IMediator mediator)
    {
        _unitOfWork = unitOfWork;
        _mediator = mediator;
    }

    public async Task<Result<bool>> Handle(ChangeStockStatusCommand request, CancellationToken cancellationToken)
    {
        var req = request.RequestData;
        var inventoryRepo = _unitOfWork.Repository<BinInventory>();
        var transactionRepo = _unitOfWork.Repository<InventoryTransaction>();

        // 1. Kéo tồn kho lên kiểm tra
        var spec = new BinInventoryForStatusChangeSpec(req.BinId, req.ProductId, req.LotNumber);
        var inventory = await inventoryRepo.GetEntityWithSpecAsync(spec, cancellationToken);

        if (inventory == null)
            return Result<bool>.Failure("Không tìm thấy lô hàng này tại ô kệ đã chọn.");

        if (inventory.Status == req.NewStatus)
            return Result<bool>.Failure($"Lô hàng này hiện đã ở trạng thái {req.NewStatus}, không cần thay đổi.");

        string oldStatus = inventory.Status.ToString();
        string binCode = inventory.Bin?.Code ?? "UNKNOWN";

        // 2. Cập nhật trạng thái mới
        inventory.Status = req.NewStatus;
        inventoryRepo.Update(inventory);

        // 3. Ghi Sổ cái kiểm toán (Audit Log)
        await transactionRepo.AddAsync(new InventoryTransaction
        {
            Id = Guid.NewGuid(),
            ProductId = req.ProductId,
            TransactionType = "STATUS_CHANGE", // Ghi nhận loại giao dịch đổi trạng thái
            QuantityChanged = 0, // Không làm thay đổi số lượng
            SourceBinCode = binCode,
            DestinationBinCode = binCode,
            ReasonCode = $"[{oldStatus} -> {req.NewStatus.ToString().ToUpper()}] {req.ReasonCode}",
            CreatedBy = "WarehouseManager", // Theo RBAC
            CreatedAt = DateTime.UtcNow
        }, cancellationToken);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // 4. Phát Domain Event (Tùy chọn: Để gửi Email cảnh báo hoặc SignalR)
        if (req.NewStatus == InventoryStatus.QCHold || req.NewStatus == InventoryStatus.Damaged)
        {
            await _mediator.Publish(new InventoryChangedEvent
            {
                EventType = "STOCK_QC_HOLD",
                Message = $"CẢNH BÁO: Đã chuyển {inventory.Quantity} sản phẩm tại kệ {binCode} sang trạng thái {req.NewStatus}. Lý do: {req.ReasonCode}"
            }, cancellationToken);
        }

        return Result<bool>.Success(true, $"Đã chuyển trạng thái lô hàng sang {req.NewStatus} thành công.");
    }
}