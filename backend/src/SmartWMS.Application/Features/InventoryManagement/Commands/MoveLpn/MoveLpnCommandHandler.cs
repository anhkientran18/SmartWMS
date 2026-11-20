using MediatR;
using SmartWMS.Application.Common.Events;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InventoryManagement.Specifications.Commands;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.InventoryManagement.Commands.MoveLpn;

public sealed class MoveLpnCommandHandler : IRequestHandler<MoveLpnCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMediator _mediator;

    public MoveLpnCommandHandler(IUnitOfWork unitOfWork, IMediator mediator)
    {
        _unitOfWork = unitOfWork;
        _mediator = mediator;
    }

    public async Task<Result<bool>> Handle(MoveLpnCommand request, CancellationToken cancellationToken)
    {
        var req = request.RequestData;
        var inventoryRepo = _unitOfWork.Repository<BinInventory>();
        var binRepo = _unitOfWork.Repository<Bin>();
        var transRepo = _unitOfWork.Repository<InventoryTransaction>();

        // 1. Tìm toàn bộ hàng hóa trên Pallet này
        var lpnStocks = await inventoryRepo.ListAsync(new BinInventoriesByLpnSpec(req.LpnCode), cancellationToken);

        if (!lpnStocks.Any())
            return Result<bool>.Failure($"Không tìm thấy mặt hàng khả dụng nào gắn với Pallet ({req.LpnCode}).");

        // 2. Kiểm tra sức chứa Ô kệ đích
        var targetBin = await binRepo.GetEntityWithSpecAsync(new TargetBinForMoveSpec(req.ToBinId), cancellationToken);

        if (targetBin == null)
            return Result<bool>.Failure("Vị trí ô kệ đích không tồn tại hoặc đã bị tháo dỡ.");

        int totalWeightToMove = lpnStocks.Sum(x => x.Quantity);
        if ((targetBin.CurrentOccupancy + totalWeightToMove) > targetBin.MaxCapacity)
            return Result<bool>.Failure($"Quá tải! Ô kệ đích {targetBin.Code} không đủ sức chứa cho Pallet này.");

        var sourceBinCode = lpnStocks.First().Bin?.Code ?? "UNKNOWN";

        // 3. Thực thi chuyển đổi hàng loạt (Bulk Transfer)
        foreach (var stock in lpnStocks)
        {
            // Trừ sức chứa kệ cũ
            if (stock.Bin != null) stock.Bin.CurrentOccupancy -= stock.Quantity;

            // Cập nhật vị trí kệ mới cho tồn kho
            stock.BinId = req.ToBinId;

            // Ghi nhật ký luân chuyển (Audit Log)
            await transRepo.AddAsync(new InventoryTransaction
            {
                Id = Guid.NewGuid(),
                ProductId = stock.ProductId,
                TransactionType = TransactionType.Transfer.ToString().ToUpper(),
                QuantityChanged = stock.Quantity,
                SourceBinCode = sourceBinCode,
                DestinationBinCode = targetBin.Code ?? "UNKNOWN",
                ReasonCode = $"LPN_MOVEMENT_{req.LpnCode}",
                CreatedBy = "WMS_LpnEngine",
                CreatedAt = DateTime.UtcNow
            }, cancellationToken);

            inventoryRepo.Update(stock);
        }

        // Cộng sức chứa kệ mới
        targetBin.CurrentOccupancy += totalWeightToMove;
        binRepo.Update(targetBin);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // 4. Phát Event hệ thống (Để cập nhật Real-time SignalR sau này)
        await _mediator.Publish(new InventoryChangedEvent
        {
            EventType = "LPN_MOVED",
            Message = $"Pallet {req.LpnCode} đã được chuyển tới {targetBin.Code}."
        }, cancellationToken);

        return Result<bool>.Success(true, $"Đã dịch chuyển nguyên Pallet {req.LpnCode} thành công.");
    }
}