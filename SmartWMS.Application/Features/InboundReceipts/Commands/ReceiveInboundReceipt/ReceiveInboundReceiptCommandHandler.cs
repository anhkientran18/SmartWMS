using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InboundReceipts.DTOs.Commands;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.InboundReceipts.Commands.ReceiveInboundReceipt;

public sealed class ReceiveInboundReceiptCommandHandler : IRequestHandler<ReceiveInboundReceiptCommand, Result<bool>>
{
    private readonly IApplicationDbContext _context;
    private readonly IInventoryNotificationService _notificationService;

    // ĐÃ PHỤC HỒI: Tiêm DbContext và Dịch vụ Notification gốc của bạn
    public ReceiveInboundReceiptCommandHandler(IApplicationDbContext context, IInventoryNotificationService notificationService)
    {
        _context = context;
        _notificationService = notificationService;
    }

    public async Task<Result<bool>> Handle(ReceiveInboundReceiptCommand request, CancellationToken cancellationToken)
    {
        var reqData = request.RequestData;

        // 1. Kéo dữ liệu Phiếu nhập và toàn bộ Line Items lên
        var receipt = await _context.InboundReceipts
            .Include(r => r.Items)
            .FirstOrDefaultAsync(r => r.Id == reqData.InboundReceiptId, cancellationToken);

        if (receipt == null) return Result<bool>.Failure("Không tìm thấy phiếu nhập kho hệ thống.");
        if (receipt.Status == "Completed") return Result<bool>.Failure("Phiếu nhập này đã hoàn tất, không thể cập nhật thêm.");
        if (receipt.BinId == null) return Result<bool>.Failure("Phiếu nhập chưa được chỉ định ô kệ đích (BinId) để hạ hàng.");

        // 2. Kéo dữ liệu Ô kệ đích để kiểm tra sức chứa
        var bin = await _context.Bins.FirstOrDefaultAsync(b => b.Id == receipt.BinId, cancellationToken);
        if (bin == null) return Result<bool>.Failure("Không tìm thấy ô kệ chỉ định trên sơ đồ kho bãi.");

        var receivedQuantities = new Dictionary<Guid, long>();
        foreach (var reqItem in reqData.ReceivedItems)
        {
            if (reqItem.QuantityReceived < 0)
                return Result<bool>.Failure(ErrorCodeConstants.ValidationError, "Số lượng thực nhận không được âm.");

            var existingItem = receipt.Items.FirstOrDefault(i => i.Id == reqItem.ItemId);
            if (existingItem == null)
                return Result<bool>.Failure(ErrorCodeConstants.ValidationError, "Mặt hàng nhận không thuộc phiếu nhập này.");

            receivedQuantities.TryGetValue(reqItem.ItemId, out var quantity);
            quantity += reqItem.QuantityReceived;
            if (quantity > (long)existingItem.QuantityExpected - existingItem.QuantityReceived)
                return Result<bool>.Failure(ErrorCodeConstants.ValidationError, "Số lượng nhận vượt quá số lượng còn lại trên phiếu nhập.");

            receivedQuantities[reqItem.ItemId] = quantity;
        }

        var notifications = new List<InventoryUpdateModel>();

        foreach (var reqItem in reqData.ReceivedItems)
        {
            var existingItem = receipt.Items.FirstOrDefault(i => i.Id == reqItem.ItemId);
            if (existingItem != null && reqItem.QuantityReceived > 0)
            {
                // A. Kiểm tra sức chứa vật lý của kệ
                if (bin.CurrentOccupancy + reqItem.QuantityReceived > bin.MaxCapacity)
                {
                    return Result<bool>.Failure($"Ô kệ {bin.Code} không đủ sức chứa! Lượng hàng chuẩn bị hạ: {reqItem.QuantityReceived}.");
                }

                // B. Cập nhật chứng từ
                existingItem.QuantityReceived += reqItem.QuantityReceived;

                // C. PHỤC HỒI NGHIỆP VỤ LÕI: Tồn kho thực tế (BinInventory)
                var lotNumber = string.IsNullOrWhiteSpace(existingItem.LotNumber) ? "LOT-DEFAULT" : existingItem.LotNumber;
                var inventory = _context.BinInventories.Local.FirstOrDefault(x =>
                    x.BinId == receipt.BinId && x.ProductId == existingItem.ProductId && x.LotNumber == lotNumber);
                inventory ??= await _context.BinInventories
                    .FirstOrDefaultAsync(x => x.BinId == receipt.BinId &&
                                              x.ProductId == existingItem.ProductId &&
                                              x.LotNumber == lotNumber, cancellationToken);

                if (inventory == null)
                {
                    _context.BinInventories.Add(new BinInventory
                    {
                        Id = Guid.NewGuid(),
                        BinId = receipt.BinId.Value,
                        ProductId = existingItem.ProductId,
                        LotNumber = lotNumber,
                        ExpirationDate = existingItem.ExpirationDate,
                        Quantity = reqItem.QuantityReceived,
                        Status = InventoryStatus.Available
                    });
                }
                else
                {
                    inventory.Quantity += reqItem.QuantityReceived;
                }

                // D. Cập nhật lấp đầy kệ
                bin.CurrentOccupancy += reqItem.QuantityReceived;

                // E. PHỤC HỒI SỔ CÁI: Ghi nhận Inventory Transaction
                _context.InventoryTransactions.Add(new InventoryTransaction
                {
                    Id = Guid.NewGuid(),
                    ProductId = existingItem.ProductId,
                    TransactionType = TransactionType.Inbound.ToString().ToUpper(),
                    QuantityChanged = reqItem.QuantityReceived,
                    SourceBinCode = "RECEIVING_DOCK",
                    DestinationBinCode = bin.Code ?? "UNKNOWN",
                    ReasonCode = "INBOUND_RECEIPT",
                    CreatedBy = "WarehouseStaff",
                    CreatedAt = DateTime.UtcNow
                });

                // F. PHỤC HỒI REAL-TIME: Bắn SignalR cập nhật Dashboard
                var product = await _context.Products.FindAsync(new object[] { existingItem.ProductId }, cancellationToken);
                if (product != null)
                {
                    notifications.Add(new InventoryUpdateModel
                    {
                        ProductId = product.Id,
                        ProductName = product.Name,
                        Quantity = reqItem.QuantityReceived,
                        Action = "INBOUND",
                        Timestamp = DateTime.UtcNow,
                        Message = $"Đã nhận {reqItem.QuantityReceived} sản phẩm vào kệ {bin.Code}"
                    });
                }
            }
        }

        // 3. Đánh giá trạng thái tổng
        receipt.Status = receipt.Items.All(i => i.QuantityReceived >= i.QuantityExpected) ? "Completed" : "Processing";

        await _context.SaveChangesAsync(cancellationToken);

        foreach (var notification in notifications)
            await _notificationService.SendInventoryUpdateAsync(notification);

        return Result<bool>.Success(true, $"Đã ghi nhận số liệu kiểm đếm vật lý. Trạng thái hiện tại: {receipt.Status}");
    }
}
