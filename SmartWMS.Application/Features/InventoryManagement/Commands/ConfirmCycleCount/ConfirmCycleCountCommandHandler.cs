using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Domain.Entities;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.InventoryManagement.Commands.ConfirmCycleCount;

public class ConfirmCycleCountCommandHandler : IRequestHandler<ConfirmCycleCountCommand, Result<bool>>
{
    private readonly IApplicationDbContext _context;

    public ConfirmCycleCountCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<bool>> Handle(ConfirmCycleCountCommand request, CancellationToken cancellationToken)
    {
        // 1. Tìm bản ghi tồn kho hệ thống (System Quantity) đang ghi nhận
        var inventory = await _context.BinInventories
            .Include(x => x.Bin)
            .FirstOrDefaultAsync(x => x.BinId == request.BinId &&
                                      x.ProductId == request.ProductId &&
                                      x.LotNumber == request.LotNumber, cancellationToken);

        if (inventory == null)
        {
            return Result<bool>.Failure("Không tìm thấy dữ liệu dòng kho tương ứng để đối chiếu.");
        }

        int systemQuantity = inventory.Quantity;
        int discrepancy = request.PhysicalQuantity - systemQuantity; // Tính Delta chênh lệch số học

        if (discrepancy == 0)
        {
            return Result<bool>.Success(true, "Số liệu khớp tuyệt đối. Hệ thống không cần điều chỉnh.");
        }

        // 2. THỰC THI ĐIỀU CHỈNH CÂN ĐỐI (Inventory Reconciliation)
        inventory.Quantity = request.PhysicalQuantity;
        if (inventory.Bin != null)
        {
            inventory.Bin.CurrentOccupancy += discrepancy; // Cập nhật lại dung lượng double của kệ vật lý
        }

        // 3. GHI NHẬT KÝ KIỂM TOÁN SỔ CÁI (Audit Trail)
        var transaction = new InventoryTransaction
        {
            Id = Guid.NewGuid(),
            ProductId = request.ProductId,
            TransactionType = "CYCLE_COUNT_ADJUST",
            QuantityChanged = discrepancy, // Lưu lượng biến động âm hoặc dương
            SourceBinCode = inventory.Bin?.Code ?? "UNKNOWN",
            DestinationBinCode = inventory.Bin?.Code ?? "UNKNOWN",
            ReasonCode = discrepancy > 0 ? "CYCLE_COUNT_SURPLUS" : "CYCLE_COUNT_SHORTAGE", // Thừa hoặc Thiếu hàng
            CreatedBy = "QC_Manager",
            CreatedAt = DateTime.UtcNow
        };
        _context.InventoryTransactions.Add(transaction);

        await _context.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, $"Đã xác nhận phiếu đếm. Hệ thống tự động điều chỉnh lệch {discrepancy} sản phẩm và ghi sổ toán kho thành công.");
    }
}