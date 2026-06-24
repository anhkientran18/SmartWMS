using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Domain.Enums; // 🌟 BỔ SUNG: Import namespace chứa Enum để xử lý đồng bộ
using Microsoft.Extensions.Logging;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.InventoryManagement.Commands.LockExpiredStock;

// Bộ máy xử lý rà soát thời gian thực hạn dùng của từng mã lô hàng (FEFO Engine)
public class LockExpiredStockCommandHandler : IRequestHandler<LockExpiredStockCommand, Result<int>>
{
    private readonly IApplicationDbContext _context;
    private readonly ILogger<LockExpiredStockCommandHandler> _logger;

    public LockExpiredStockCommandHandler(IApplicationDbContext context, ILogger<LockExpiredStockCommandHandler> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<Result<int>> Handle(LockExpiredStockCommand request, CancellationToken cancellationToken)
    {
        // Thiết lập biên độ cảnh báo an toàn của doanh nghiệp: Thời gian hiện tại + 30 ngày
        DateTime warningThreshold = DateTime.UtcNow.AddDays(30);

        // 1. Quét tìm toàn bộ các lô hàng khả dụng (Available) đã chạm hoặc vượt ngưỡng ngày hết hạn
        var expiredLots = await _context.BinInventories
            .Where(x => x.Status == InventoryStatus.Available && // 🌟 ĐÃ SỬA: So sánh với Enum thay vì string thô
                        x.ExpirationDate != null &&
                        x.ExpirationDate <= warningThreshold)
            .ToListAsync(cancellationToken);

        if (!expiredLots.Any())
        {
            return Result<int>.Success(0, "Hệ thống an toàn. Không phát hiện lô hàng nào bị cận hạn hoặc hết hạn.");
        }

        int affectedRows = 0;
        foreach (var lot in expiredLots)
        {
            // 🌟 ĐÃ SỬA: Thay đổi sang thuộc tính Status và gán bằng kiểu Enum Expired chuẩn hóa
            lot.Status = InventoryStatus.Expired;
            affectedRows++;

            // Ghi log cấu trúc phục vụ giám sát hạ tầng
            _logger.LogWarning("⚠️ [SmartWMS SAFETY] Đã đóng băng lô hàng {Lot} của sản phẩm ID: {Product}. Lý do: Hạn dùng {Date} rơi vào vùng nguy hiểm.",
                lot.LotNumber, lot.ProductId, lot.ExpirationDate);
        }

        // 2. Đồng bộ trạng thái mới xuống Database
        await _context.SaveChangesAsync(cancellationToken);

        return Result<int>.Success(affectedRows, $"Hệ thống đã tự động khóa bảo vệ thành công {affectedRows} lô hàng.");
    }
}