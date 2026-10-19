using MediatR;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InventoryManagement.Specifications.Commands;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.InventoryManagement.Commands.AdjustStock;

public class AdjustStockCommandHandler : IRequestHandler<AdjustStockCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;

    public AdjustStockCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<bool>> Handle(AdjustStockCommand request, CancellationToken cancellationToken)
    {
        var req = request.RequestData;
        var binRepo = _unitOfWork.Repository<Bin>();
        var invRepo = _unitOfWork.Repository<BinInventory>();
        var transRepo = _unitOfWork.Repository<InventoryTransaction>();

        // 1. Kéo dữ liệu Ô kệ lên kiểm tra
        var bin = await binRepo.GetEntityWithSpecAsync(new BinForAdjustSpec(req.BinId), cancellationToken);
        if (bin == null) return Result<bool>.Failure("Vị trí ô kệ không tồn tại hoặc đã bị tháo dỡ.");

        // 2. Kéo dữ liệu Tồn kho hiện tại lên
        var inventory = await invRepo.GetEntityWithSpecAsync(new BinInventoryForAdjustSpec(req.BinId, req.ProductId, req.LotNumber), cancellationToken);

        // TH 1: ĐIỀU CHỈNH TĂNG (+)
        if (req.AdjustmentQuantity > 0)
        {
            if (bin.CurrentOccupancy + req.AdjustmentQuantity > bin.MaxCapacity)
                return Result<bool>.Failure($"Kệ {bin.Code} không đủ sức chứa cho lượng hàng điểu chỉnh tăng.");

            if (inventory == null)
            {
                await invRepo.AddAsync(new BinInventory
                {
                    Id = Guid.NewGuid(),
                    BinId = req.BinId,
                    ProductId = req.ProductId,
                    LotNumber = string.IsNullOrWhiteSpace(req.LotNumber) ? "LOT-DEFAULT" : req.LotNumber,
                    Quantity = req.AdjustmentQuantity,
                    Status = InventoryStatus.Available
                }, cancellationToken);
            }
            else
            {
                inventory.Quantity += req.AdjustmentQuantity;
                invRepo.Update(inventory);
            }
        }
        // TH 2: ĐIỀU CHỈNH GIẢM (-)
        else
        {
            if (inventory == null || inventory.Quantity < Math.Abs(req.AdjustmentQuantity))
                return Result<bool>.Failure("Tồn kho hiện tại không đủ để thực hiện điều chỉnh giảm theo yêu cầu.");

            inventory.Quantity += req.AdjustmentQuantity; // Vì req.AdjustmentQuantity là số âm nên += sẽ thành trừ
            invRepo.Update(inventory);
        }

        // 3. Cập nhật sức chứa của Kệ
        bin.CurrentOccupancy += req.AdjustmentQuantity;
        binRepo.Update(bin);

        // 4. Ghi Sổ cái (Audit Log)
        await transRepo.AddAsync(new InventoryTransaction
        {
            Id = Guid.NewGuid(),
            ProductId = req.ProductId,
            TransactionType = TransactionType.Adjustment.ToString().ToUpper(),
            QuantityChanged = req.AdjustmentQuantity,
            SourceBinCode = req.AdjustmentQuantity < 0 ? bin.Code : "N/A",
            DestinationBinCode = req.AdjustmentQuantity > 0 ? bin.Code : "N/A",
            ReasonCode = req.ReasonCode,
            CreatedBy = "WarehouseManager", // Theo RBAC của bạn
            CreatedAt = DateTime.UtcNow
        }, cancellationToken);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        string actionName = req.AdjustmentQuantity > 0 ? "tăng" : "giảm";
        return Result<bool>.Success(true, $"Đã điều chỉnh {actionName} {Math.Abs(req.AdjustmentQuantity)} sản phẩm thành công.");
    }
}