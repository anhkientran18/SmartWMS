using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Events;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums; // Chứa InventoryStatus (Available, Damaged)
using System;
using System.Linq;
using System.Threading; // Bổ sung để sử dụng CancellationToken
using System.Threading.Tasks;

namespace SmartWMS.Infrastructure.Services;

public class InventoryJobService : IInventoryJobService
{
    private readonly IApplicationDbContext _context;
    private readonly IMediator _mediator;

    public InventoryJobService(IApplicationDbContext context, IMediator mediator)
    {
        _context = context;
        _mediator = mediator;
    }

    public async Task RunExpiredStockLockJobAsync()
    {
        var today = DateTime.UtcNow;

        // 1. Quét tìm tất cả các lô hàng đã đến hoặc vượt quá ngày hết hạn sử dụng nhưng vẫn ở trạng thái sẵn sàng bán
        var expiredStocks = await _context.BinInventories
            .Include(x => x.Bin)
            .Where(x => x.Status == InventoryStatus.Available && x.ExpirationDate <= today)
            .ToListAsync();

        if (!expiredStocks.Any())
        {
            return; // Kho hàng an toàn, không có hàng hết hạn
        }

        int totalLockedItems = 0;

        // 2. VÒNG LẶP ĐÓNG BĂNG VÀ CHUYỂN VÙNG HÀNG HẾT HẠN
        foreach (var stock in expiredStocks)
        {
            // Khóa trạng thái khả dụng để các bộ máy bốc hàng (Picking Engine) không bao giờ bốc trúng
            stock.Status = InventoryStatus.Damaged;
            totalLockedItems += stock.Quantity;

            // Ghi nhận biến động âm vào Sổ cái giao dịch kiểm soát chất lượng (FEFO Auto Lock Audit)
            _context.InventoryTransactions.Add(new InventoryTransaction
            {
                Id = Guid.NewGuid(),
                ProductId = stock.ProductId,
                TransactionType = "FEFO_AUTO_LOCK",
                QuantityChanged = -stock.Quantity,
                SourceBinCode = stock.Bin?.Code ?? "UNKNOWN",
                DestinationBinCode = "LOCK_ZONE",
                ReasonCode = $"EXPIRED_DATE_REACHED: {stock.ExpirationDate:yyyy-MM-dd}",
                CreatedBy = "WMS_FEFO_AutoJob",
                CreatedAt = DateTime.UtcNow
            });
        }

        // 3. ĐỒNG BỘ XUỐNG DATABASE
        // ĐÃ SỬA: Bổ sung CancellationToken.None để đáp ứng nghiêm ngặt tham số yêu cầu của IApplicationDbContext
        await _context.SaveChangesAsync(CancellationToken.None);

        // 4. PHÁT SÓNG REAL-TIME QUA MEDIATR & SIGNALR
        // Đẩy thông báo khẩn cấp lên màn hình của Quản lý kho trung tâm ngay trong đêm
        await _mediator.Publish(new InventoryChangedEvent
        {
            EventType = "QUARANTINE_HOLD",
            Message = $"Hệ thống FEFO tối ưu đã tự động quét, phát hiện và khóa cứng thành công {totalLockedItems} sản phẩm quá hạn sử dụng ngoài hiện trường kệ."
        });
    }
}