using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Events; // 1. IMPORT THÊM NAMESPACE CHỨA SỰ KIỆN
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.InventoryManagement.Commands.ProcessDamageQuarantine;

public class ProcessDamageQuarantineCommandHandler : IRequestHandler<ProcessDamageQuarantineCommand, Result<bool>>
{
    private readonly IApplicationDbContext _context;
    private readonly IMediator _mediator; // 2. KHAI BÁO THÊM BIẾN MEDIATOR

    // 3. TIÊM VÀO CONSTRUCTOR
    public ProcessDamageQuarantineCommandHandler(IApplicationDbContext context, IMediator mediator)
    {
        _context = context;
        _mediator = mediator;
    }

    public async Task<Result<bool>> Handle(ProcessDamageQuarantineCommand request, CancellationToken cancellationToken)
    {
        if (request.QuarantineQuantity <= 0)
        {
            return Result<bool>.Failure("Số lượng hàng hóa yêu cầu cách ly phải lớn hơn 0.");
        }

        var currentStock = await _context.BinInventories
            .Include(x => x.Bin)
            .FirstOrDefaultAsync(x => x.BinId == request.BinId &&
                                      x.ProductId == request.ProductId &&
                                      x.LotNumber == request.BatchNumber &&
                                      x.Status == InventoryStatus.Available, cancellationToken);

        if (currentStock == null || currentStock.Quantity < request.QuarantineQuantity)
        {
            return Result<bool>.Failure("Thao tác thất bại. Lượng hàng tồn khả dụng thực tế tại vị trí này ít hơn số lượng báo hỏng.");
        }

        // Thực thi bóc tách hàng lỗi
        currentStock.Quantity -= request.QuarantineQuantity;
        if (currentStock.Quantity == 0) _context.BinInventories.Remove(currentStock);

        var damagedStock = await _context.BinInventories
            .FirstOrDefaultAsync(x => x.BinId == request.BinId &&
                                      x.ProductId == request.ProductId &&
                                      x.LotNumber == request.BatchNumber &&
                                      x.Status == InventoryStatus.Damaged, cancellationToken);

        if (damagedStock != null)
        {
            damagedStock.Quantity += request.QuarantineQuantity;
        }
        else
        {
            damagedStock = new BinInventory
            {
                Id = Guid.NewGuid(),
                BinId = request.BinId,
                ProductId = request.ProductId,
                LotNumber = request.BatchNumber,
                Quantity = request.QuarantineQuantity,
                ExpirationDate = currentStock.ExpirationDate,
                Status = InventoryStatus.Damaged
            };
            _context.BinInventories.Add(damagedStock);
        }

        // Ghi sổ cái
        _context.InventoryTransactions.Add(new InventoryTransaction
        {
            Id = Guid.NewGuid(),
            ProductId = request.ProductId,
            TransactionType = "QUARANTINE_HOLD",
            QuantityChanged = -request.QuarantineQuantity,
            SourceBinCode = currentStock.Bin?.Code ?? "UNKNOWN",
            DestinationBinCode = "QUARANTINE_ZONE",
            ReasonCode = $"DAMAGE_REPORTED: {request.DamageReason}",
            CreatedBy = "WMS_DamageEngine",
            CreatedAt = DateTime.UtcNow
        });

        // Lưu xuống SQL Server
        await _context.SaveChangesAsync(cancellationToken);

        // ============================================================================
        // 🌟 BỔ SUNG: PHÁT SÓNG REAL-TIME (MEDIATOR PUBLISH)
        // Lệnh này chạy sau khi DB đã lưu thành công
        // ============================================================================
        await _mediator.Publish(new InventoryChangedEvent
        {
            EventType = "QUARANTINE_HOLD",
            Message = $"Phát hiện {request.QuarantineQuantity} sản phẩm lỗi tại ô kệ {currentStock.Bin?.Code}! Hệ thống đã tự động cách ly."
        }, cancellationToken);
        // ============================================================================

        return Result<bool>.Success(true, $"Đã bóc tách và khóa thành công {request.QuarantineQuantity} sản phẩm lỗi vào khu vực cách ly kiểm định.");
    }
}