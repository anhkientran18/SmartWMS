using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums; // Đã bao gồm hệ thống Enum dùng chung
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.InventoryManagement.Commands.AdjustStock;

public class AdjustStockCommandHandler : IRequestHandler<AdjustStockCommand, Result<Guid>>
{
    private readonly IApplicationDbContext _context;

    public AdjustStockCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<Guid>> Handle(AdjustStockCommand request, CancellationToken cancellationToken)
    {
        if (request.NewQuantity < 0)
        {
            return Result<Guid>.Failure("Số lượng tồn kho sau hiệu chỉnh không được phép nhỏ hơn 0.");
        }

        if (string.IsNullOrWhiteSpace(request.ReasonCode))
        {
            return Result<Guid>.Failure("Bắt buộc phải nhập mã lý do (Reason Code) để phục vụ kiểm toán kho.");
        }

        var bin = await _context.Bins
            .FirstOrDefaultAsync(b => b.Id == request.BinId, cancellationToken);

        if (bin == null)
        {
            return Result<Guid>.Failure("Không tìm thấy ô kệ chỉ định trên sơ đồ.");
        }

        var inventory = await _context.BinInventories
            .FirstOrDefaultAsync(x => x.BinId == request.BinId &&
                                      x.ProductId == request.ProductId &&
                                      x.LotNumber == request.LotNumber, cancellationToken);

        int oldQuantity = inventory?.Quantity ?? 0;
        int deltaQuantity = request.NewQuantity - oldQuantity;

        if (deltaQuantity == 0)
        {
            return Result<Guid>.Success(inventory?.Id ?? Guid.Empty, "Số lượng hiệu chỉnh trùng khớp với số lượng hệ thống. Không cần cập nhật.");
        }

        if (deltaQuantity > 0)
        {
            var potentialOccupancy = bin.CurrentOccupancy + deltaQuantity;
            if (potentialOccupancy > bin.MaxCapacity)
            {
                var remainingSpace = bin.MaxCapacity - bin.CurrentOccupancy;
                return Result<Guid>.Failure($"Không thể cân đối tăng! Ô kệ {bin.Code} chỉ còn trống ({Math.Round(remainingSpace, 2)}), không đủ chứa thêm lượng chênh lệch ({deltaQuantity}).");
            }
        }

        if (inventory == null)
        {
            inventory = new BinInventory
            {
                Id = Guid.NewGuid(),
                BinId = request.BinId,
                ProductId = request.ProductId,
                LotNumber = string.IsNullOrWhiteSpace(request.LotNumber) ? "LOT-UNKN" : request.LotNumber,
                Quantity = request.NewQuantity,
                Status = request.ReasonCode == "DAMAGED" ? InventoryStatus.Damaged : InventoryStatus.Available
            };
            _context.BinInventories.Add(inventory);
        }
        else
        {
            inventory.Quantity = request.NewQuantity;

            if (request.ReasonCode == "DAMAGED")
            {
                inventory.Status = InventoryStatus.Damaged;
            }

            if (inventory.Quantity == 0)
            {
                _context.BinInventories.Remove(inventory);
            }
        }

        bin.CurrentOccupancy += deltaQuantity;

        // ============================================================================
        // 🌟 ĐÃ CẬP NHẬT: TỰ ĐỘNG GHI SỔ CÁI BIẾN ĐỘNG KHO (Sử dụng Enum an toàn)
        // ============================================================================
        var transaction = new InventoryTransaction
        {
            Id = Guid.NewGuid(),
            ProductId = request.ProductId,
            // 🚀 KHÔNG CÒN MAGIC STRING: Tự động chuyển đổi thành "ADJUSTMENT" tương thích DB cũ
            TransactionType = TransactionType.Adjustment.ToString().ToUpper(),
            QuantityChanged = deltaQuantity,
            SourceBinCode = deltaQuantity < 0 ? (bin.Code ?? "UNKNOWN") : "SYSTEM_ADJUST",
            DestinationBinCode = deltaQuantity > 0 ? (bin.Code ?? "UNKNOWN") : "SYSTEM_ADJUST",
            ReasonCode = request.ReasonCode,
            CreatedBy = WarehouseRole.Manager.ToString(), // 🚀 Đồng bộ chuỗi phân quyền "Manager"
            CreatedAt = DateTime.UtcNow
        };
        _context.InventoryTransactions.Add(transaction);

        await _context.SaveChangesAsync(cancellationToken);

        return Result<Guid>.Success(inventory.Id, $"Hiệu chỉnh kho thành công tại ô {bin.Code}. Lý do: {request.ReasonCode}. Lệch net: {deltaQuantity}");
    }
}