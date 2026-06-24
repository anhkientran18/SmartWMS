using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Events;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Domain.Entities;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.InventoryManagement.Commands.MoveInventory;

public class MoveInventoryCommandHandler : IRequestHandler<MoveInventoryCommand, Result<bool>>
{
    private readonly IApplicationDbContext _context;
    private readonly IMediator _mediator;

    public MoveInventoryCommandHandler(IApplicationDbContext context, IMediator mediator)
    {
        _context = context;
        _mediator = mediator;
    }

    public async Task<Result<bool>> Handle(MoveInventoryCommand request, CancellationToken cancellationToken)
    {
        // 1. Kiểm tra tính hợp lệ của ô kệ đích và tính toán không gian chứa
        var targetBin = await _context.Bins
            .FirstOrDefaultAsync(b => b.Id == request.ToBinId && !b.IsDeleted, cancellationToken);

        if (targetBin == null)
            return Result<bool>.Failure("Ô kệ đích không tồn tại hoặc đã bị tháo dỡ trên sơ đồ kho.");

        // Kế thừa công thức tính không gian trống tường minh từ MoveStock
        double availableSpace = targetBin.MaxCapacity - targetBin.CurrentOccupancy;
        if (availableSpace < request.MoveQuantity)
        {
            return Result<bool>.Failure($"Ô kệ đích đã quá tải! Không gian trống còn lại ({Math.Round(availableSpace, 2)}), không đủ chứa ({request.MoveQuantity}) sản phẩm.");
        }

        // 2. Kiểm tra tồn kho thực tế tại ô kệ nguồn
        var sourceInventory = await _context.BinInventories
            .Include(x => x.Bin)
            .FirstOrDefaultAsync(x => x.BinId == request.FromBinId &&
                                      x.ProductId == request.ProductId &&
                                      x.LotNumber == request.LotNumber, cancellationToken);

        if (sourceInventory == null || sourceInventory.Quantity < request.MoveQuantity)
            return Result<bool>.Failure("Thao tác thất bại! Ô kệ nguồn không đủ số lượng tồn kho thực tế của mã lô này.");

        try
        {
            string sourceBinCode = sourceInventory.Bin?.Code ?? "UNKNOWN";

            // 3. Khấu trừ số lượng tại vị trí nguồn
            sourceInventory.Quantity -= request.MoveQuantity;
            if (sourceInventory.Bin != null)
            {
                sourceInventory.Bin.CurrentOccupancy -= request.MoveQuantity;
            }

            // Nếu số lượng về 0, tiến hành xóa bản ghi tồn kho tại kệ nguồn để sạch Database
            if (sourceInventory.Quantity == 0)
            {
                _context.BinInventories.Remove(sourceInventory);
            }

            // 4. Cộng dồn hoặc khởi tạo mới tồn kho tại vị trí đích
            var targetInventory = await _context.BinInventories
                .FirstOrDefaultAsync(x => x.BinId == request.ToBinId &&
                                          x.ProductId == request.ProductId &&
                                          x.LotNumber == request.LotNumber, cancellationToken);

            if (targetInventory != null)
            {
                targetInventory.Quantity += request.MoveQuantity;
            }
            else
            {
                targetInventory = new BinInventory
                {
                    Id = Guid.NewGuid(),
                    BinId = request.ToBinId,
                    ProductId = request.ProductId,
                    LotNumber = request.LotNumber,
                    Quantity = request.MoveQuantity,
                    Status = sourceInventory.Status,
                    ExpirationDate = sourceInventory.ExpirationDate
                };
                _context.BinInventories.Add(targetInventory);
            }

            // Cập nhật lại dung tích hiện tại của ô kệ đích
            targetBin.CurrentOccupancy += request.MoveQuantity;

            // 5. TỰ ĐỘNG GHI SỔ CÁI BIẾN ĐỘNG KHO (AUDIT TRAIL LOG)
            _context.InventoryTransactions.Add(new InventoryTransaction
            {
                Id = Guid.NewGuid(),
                ProductId = request.ProductId,
                TransactionType = "INTERNAL_TRANSFER",
                QuantityChanged = request.MoveQuantity,
                SourceBinCode = sourceBinCode,
                DestinationBinCode = targetBin.Code ?? "UNKNOWN",
                ReasonCode = "BIN_TO_BIN_MOVEMENT",
                CreatedBy = "Warehouse_Operator",
                CreatedAt = DateTime.UtcNow
            });

            await _context.SaveChangesAsync(cancellationToken);

            // 6. PHÁT SÓNG REAL-TIME: Bắn tín hiệu MediatR đẩy SignalR cập nhật màn hình Dashboard
            await _mediator.Publish(new InventoryChangedEvent
            {
                EventType = "INTERNAL_TRANSFER",
                Message = $"Đã dịch chuyển thành công {request.MoveQuantity} sản phẩm từ ô kệ {sourceBinCode} sang ô kệ {targetBin.Code}."
            }, cancellationToken);

            return Result<bool>.Success(true, $"Điều chuyển nội bộ thành công {request.MoveQuantity} sản phẩm sang ô kệ {targetBin.Code}.");
        }
        catch (DbUpdateConcurrencyException)
        {
            return Result<bool>.Failure("Hệ thống phát hiện tranh chấp dữ liệu thời gian thực do có người khác đang bốc dỡ tại ô kệ này. Vui lòng tải lại dữ liệu.");
        }
    }
}