using MediatR;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Kitting.Specifications.Commands;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Kitting.Commands.AssembleKit;

public class AssembleKitCommandHandler : IRequestHandler<AssembleKitCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;

    public AssembleKitCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<bool>> Handle(AssembleKitCommand request, CancellationToken cancellationToken)
    {
        var req = request.RequestData;
        var invRepo = _unitOfWork.Repository<BinInventory>();
        var transRepo = _unitOfWork.Repository<InventoryTransaction>();
        var binRepo = _unitOfWork.Repository<Bin>();

        // 1. TRỪ TỒN KHO CÁC SẢN PHẨM THÀNH PHẦN (COMPONENTS)
        foreach (var comp in req.Components)
        {
            int totalNeeded = comp.QuantityPerKit * req.AssembleQuantity;

            var sourceInv = await invRepo.GetEntityWithSpecAsync(new BinInventoryForKittingSpec(comp.SourceBinId, comp.ComponentProductId), cancellationToken);

            if (sourceInv == null || sourceInv.Quantity < totalNeeded)
                return Result<bool>.Failure(ErrorCodeConstants.ValidationError, $"Tồn kho không đủ cho thành phần {comp.ComponentProductId} tại kệ nguồn.");

            // Trừ số lượng
            sourceInv.Quantity -= totalNeeded;
            invRepo.Update(sourceInv);

            // Ghi Sổ cái xuất thành phần
            await transRepo.AddAsync(new InventoryTransaction
            {
                Id = Guid.NewGuid(),
                ProductId = comp.ComponentProductId,
                TransactionType = "KITTING_ISSUE",
                QuantityChanged = -totalNeeded,
                SourceBinCode = sourceInv.Bin?.Code ?? "UNKNOWN",
                DestinationBinCode = "PACKING_STATION",
                ReasonCode = $"ASSEMBLE_KIT_{req.KitProductId}",
                CreatedAt = DateTime.UtcNow,
                CreatedBy = "WarehouseStaff"
            }, cancellationToken);
        }

        // 2. CỘNG TỒN KHO CHO SẢN PHẨM COMBO (KIT)
        var targetInv = await invRepo.GetEntityWithSpecAsync(new BinInventoryForKittingSpec(req.TargetBinId, req.KitProductId), cancellationToken);
        var targetBin = await binRepo.GetByIdAsync(req.TargetBinId, cancellationToken);

        string targetBinCode = targetBin?.Code ?? "UNKNOWN";

        if (targetInv == null)
        {
            await invRepo.AddAsync(new BinInventory
            {
                Id = Guid.NewGuid(),
                BinId = req.TargetBinId,
                ProductId = req.KitProductId,
                LotNumber = $"KIT-{DateTime.UtcNow:yyyyMMdd}",
                Quantity = req.AssembleQuantity,
                Status = InventoryStatus.Available
            }, cancellationToken);
        }
        else
        {
            targetInv.Quantity += req.AssembleQuantity;
            invRepo.Update(targetInv);
        }

        // Ghi Sổ cái nhập Combo
        await transRepo.AddAsync(new InventoryTransaction
        {
            Id = Guid.NewGuid(),
            ProductId = req.KitProductId,
            TransactionType = "KITTING_RECEIPT",
            QuantityChanged = req.AssembleQuantity,
            SourceBinCode = "PACKING_STATION",
            DestinationBinCode = targetBinCode,
            ReasonCode = $"ASSEMBLED_FROM_COMPONENTS",
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "WarehouseStaff"
        }, cancellationToken);

        // Lưu toàn bộ Transaction
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, $"Đã lắp ráp thành công {req.AssembleQuantity} bộ Combo và cất vào kệ {targetBinCode}.");
    }
}