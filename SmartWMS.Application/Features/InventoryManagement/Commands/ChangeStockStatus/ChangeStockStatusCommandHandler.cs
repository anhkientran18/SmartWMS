using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Domain.Entities;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.InventoryManagement.Commands.ChangeStockStatus;

public class ChangeStockStatusCommandHandler : IRequestHandler<ChangeStockStatusCommand, Result<Guid>>
{
    private readonly IApplicationDbContext _context;

    public ChangeStockStatusCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<Guid>> Handle(ChangeStockStatusCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            return Result<Guid>.Failure("Bắt buộc phải nhập lý do thay đổi trạng thái chất lượng hàng hóa.");
        }

        // 1. Tìm bản ghi tồn kho chi tiết khớp hoàn toàn theo ô kệ, sản phẩm và số lô (BatchNumber)
        var inventory = await _context.BinInventories
            .Include(x => x.Bin)
            .FirstOrDefaultAsync(x => x.BinId == request.BinId &&
                                      x.ProductId == request.ProductId &&
                                      x.LotNumber == request.LotNumber, cancellationToken);

        if (inventory == null)
        {
            return Result<Guid>.Failure("Không tìm thấy lô tồn kho yêu cầu chuyển đổi trạng thái.");
        }

        int oldStatusInt = (int)inventory.Status;
        if (oldStatusInt == request.NewStatus)
        {
            return Result<Guid>.Success(inventory.Id, "Trạng thái mới trùng khớp với trạng thái hiện tại. Không cần cập nhật.");
        }

        // 2. Tiến hành cập nhật trạng thái chất lượng (Ép kiểu an toàn về Enum của thực thể gốc)
        // Lưu ý: Đổi tên 'InventoryStatus' bên dưới nếu Enum trong Domain của bạn đặt tên khác
        inventory.Status = (SmartWMS.Domain.Enums.InventoryStatus)request.NewStatus;

        // 3. GHI NHẬT KÝ KIỂM TOÁN SỔ CÁI KHO (Inventory Transaction Ledger)
        string binCode = inventory.Bin?.Code ?? "UNKNOWN";
        var transaction = new InventoryTransaction
        {
            Id = Guid.NewGuid(),
            ProductId = request.ProductId,
            TransactionType = "STATUS_CHANGE",
            QuantityChanged = inventory.Quantity, // Số lượng hàng bị tác động chuyển đổi trạng thái
            SourceBinCode = binCode,
            DestinationBinCode = binCode,
            ReasonCode = $"QC_SHIFT_{oldStatusInt}_TO_{request.NewStatus}",
            CreatedBy = "QC_Inspector",
            CreatedAt = DateTime.UtcNow
        };
        _context.InventoryTransactions.Add(transaction);

        // 4. Đồng bộ Transaction xuống SQL Server
        await _context.SaveChangesAsync(cancellationToken);

        return Result<Guid>.Success(inventory.Id, $"Chuyển đổi trạng thái chất lượng lô hàng tại ô {binCode} thành công sang mã trạng thái: {request.NewStatus}.");
    }
}