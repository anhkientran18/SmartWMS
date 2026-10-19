using MediatR;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InventoryTransfers.Specifications.Commands;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.InventoryTransfers.Commands.CreateInventoryTransfer;

public sealed class CreateInventoryTransferCommandHandler : IRequestHandler<CreateInventoryTransferCommand, Result<Guid>>
{
    private readonly IUnitOfWork _unitOfWork;

    public CreateInventoryTransferCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<Guid>> Handle(CreateInventoryTransferCommand request, CancellationToken cancellationToken)
    {
        var binRepo = _unitOfWork.Repository<Bin>();
        var invRepo = _unitOfWork.Repository<BinInventory>();
        var transRepo = _unitOfWork.Repository<InventoryTransaction>();

        var req = request.RequestData;
        var lotNumber = string.IsNullOrWhiteSpace(req.LotNumber) ? "LOT-DEFAULT" : req.LotNumber;

        // 1. Kiểm tra tồn kho tại Ô Kệ Nguồn
        var sourceSpec = new SourceBinInventorySpec(req.SourceBinId, req.ProductId, lotNumber);
        var sourceInv = await invRepo.GetEntityWithSpecAsync(sourceSpec, cancellationToken);

        if (sourceInv == null || sourceInv.Quantity < req.TransferQuantity)
            return Result<Guid>.Failure(ErrorCodeConstants.ValidationError, "Ô kệ nguồn không đủ số lượng tồn kho khả dụng để thực hiện luân chuyển.");

        // 2. Lấy Ô Kệ Đích để kiểm tra sức chứa
        var destBinSpec = new DestinationBinWithInventorySpec(req.DestinationBinId);
        var destBin = await binRepo.GetEntityWithSpecAsync(destBinSpec, cancellationToken);

        if (destBin == null)
            return Result<Guid>.Failure(ErrorCodeConstants.ValidationError, "Ô kệ đích không tồn tại hoặc đã bị tháo dỡ.");

        if (destBin.CurrentOccupancy + req.TransferQuantity > destBin.MaxCapacity)
            return Result<Guid>.Failure(ErrorCodeConstants.ValidationError, $"Ô kệ đích {destBin.Code} không đủ sức chứa cho lượng hàng này.");

        // 3. Thực hiện Trừ hàng Kệ Nguồn
        sourceInv.Quantity -= req.TransferQuantity;
        if (sourceInv.Bin != null) sourceInv.Bin.CurrentOccupancy -= req.TransferQuantity;
        invRepo.Update(sourceInv);

        // 4. Thực hiện Cộng hàng Kệ Đích
        var destInvSpec = new SourceBinInventorySpec(req.DestinationBinId, req.ProductId, lotNumber);
        var destInv = await invRepo.GetEntityWithSpecAsync(destInvSpec, cancellationToken);

        if (destInv != null)
        {
            destInv.Quantity += req.TransferQuantity;
            invRepo.Update(destInv);
        }
        else
        {
            await invRepo.AddAsync(new BinInventory
            {
                Id = Guid.NewGuid(),
                BinId = req.DestinationBinId,
                ProductId = req.ProductId,
                LotNumber = lotNumber,
                Quantity = req.TransferQuantity,
                ExpirationDate = sourceInv.ExpirationDate,
                Status = InventoryStatus.Available
            }, cancellationToken);
        }

        destBin.CurrentOccupancy += req.TransferQuantity;
        binRepo.Update(destBin);

        // 5. Ghi Sổ cái (InventoryTransaction)
        var transactionId = Guid.NewGuid();
        await transRepo.AddAsync(new InventoryTransaction
        {
            Id = transactionId,
            ProductId = req.ProductId,
            TransactionType = "TRANSFER",
            QuantityChanged = req.TransferQuantity,
            SourceBinCode = sourceInv.Bin?.Code ?? req.SourceBinId.ToString(),
            DestinationBinCode = destBin.Code ?? req.DestinationBinId.ToString(),
            ReasonCode = req.Reason,
            CreatedBy = "WarehouseStaff",
            CreatedAt = DateTime.UtcNow
        }, cancellationToken);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<Guid>.Success(transactionId, "Luân chuyển nội bộ thành công.");
    }
}