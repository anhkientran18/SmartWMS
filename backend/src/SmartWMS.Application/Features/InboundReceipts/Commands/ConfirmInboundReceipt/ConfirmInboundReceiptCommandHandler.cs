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

namespace SmartWMS.Application.Features.InboundReceipts.Commands.ConfirmInboundReceipt;

public class ConfirmInboundReceiptCommandHandler : IRequestHandler<ConfirmInboundReceiptCommand, Result<Guid>>
{
    private readonly IApplicationDbContext _context;

    public ConfirmInboundReceiptCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<Guid>> Handle(ConfirmInboundReceiptCommand request, CancellationToken cancellationToken)
    {
        if (request.Quantity <= 0)
        {
            return Result<Guid>.Failure("Số lượng xác nhận nhập kho thực tế phải lớn hơn 0.");
        }

        var productExists = await _context.Products
            .AnyAsync(p => p.Id == request.ProductId, cancellationToken);

        if (!productExists)
        {
            return Result<Guid>.Failure("Thao tác bị từ chối! Mã sản phẩm không tồn tại trên hệ thống.");
        }

        var bin = await _context.Bins
            .FirstOrDefaultAsync(b => b.Id == request.BinId, cancellationToken);

        if (bin == null)
        {
            return Result<Guid>.Failure("Không tìm thấy ô kệ chỉ định trên sơ đồ kho bãi.");
        }

        var potentialOccupancy = bin.CurrentOccupancy + request.Quantity;
        if (potentialOccupancy > bin.MaxCapacity)
        {
            var remainingSpace = bin.MaxCapacity - bin.CurrentOccupancy;
            return Result<Guid>.Failure($"Ô kệ {bin.Code} không đủ sức chứa! Chỉ còn trống ({Math.Round(remainingSpace, 2)}), lượng nhập vào ({request.Quantity}).");
        }

        var existingInventory = await _context.BinInventories
            .FirstOrDefaultAsync(x => x.BinId == request.BinId &&
                                      x.ProductId == request.ProductId &&
                                      x.LotNumber == request.LotNumber, cancellationToken);

        if (existingInventory == null)
        {
            existingInventory = new BinInventory
            {
                Id = Guid.NewGuid(),
                BinId = request.BinId,
                ProductId = request.ProductId,
                LotNumber = string.IsNullOrWhiteSpace(request.LotNumber) ? "LOT-DEFAULT" : request.LotNumber,
                ExpirationDate = request.ExpirationDate,
                Quantity = request.Quantity,
                Status = InventoryStatus.Available
            };

            _context.BinInventories.Add(existingInventory);
        }
        else
        {
            existingInventory.Quantity += request.Quantity;
        }

        bin.CurrentOccupancy += request.Quantity;

        // ============================================================================
        // 🌟 ĐÃ CẬP NHẬT: TỰ ĐỘNG GHI SỔ CÁI BIẾN ĐỘNG KHO (Sử dụng Enum an toàn)
        // ============================================================================
        var transaction = new InventoryTransaction
        {
            Id = Guid.NewGuid(),
            ProductId = request.ProductId,
            // 🚀 KHÔNG CÒN MAGIC STRING: Tự động chuyển đổi thành "INBOUND" tương thích DB cũ
            TransactionType = TransactionType.Inbound.ToString().ToUpper(),
            QuantityChanged = request.Quantity,
            SourceBinCode = "RECEIVING_DOCK",
            DestinationBinCode = bin.Code ?? "UNKNOWN",
            ReasonCode = "INBOUND_RECEIPT",
            CreatedBy = WarehouseRole.Staff.ToString(), // 🚀 Đồng bộ chuỗi phân quyền "Staff"
            CreatedAt = DateTime.UtcNow
        };
        _context.InventoryTransactions.Add(transaction);

        await _context.SaveChangesAsync(cancellationToken);

        return Result<Guid>.Success(existingInventory.Id, $"Xác nhận nhập kho thành công {request.Quantity} sản phẩm vào ô kệ {bin.Code}.");
    }
}