using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums; // Đã tích hợp namespace chứa Enum dùng chung
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.InventoryManagement.Commands.AutoReplenish;

public class AutoReplenishCommandHandler : IRequestHandler<AutoReplenishCommand, Result<int>>
{
    private readonly IApplicationDbContext _context;

    public AutoReplenishCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<int>> Handle(AutoReplenishCommand request, CancellationToken cancellationToken)
    {
        // 1. Quét tìm toàn bộ các ô kệ đang có hàng nhưng tỷ lệ lấp đầy thấp hơn 20% (Cần bù hàng gấp)
        var lowStockInventories = await _context.BinInventories
            .Include(x => x.Bin)
            .Where(x => x.Bin != null &&
                        x.Bin.MaxCapacity > 0 &&
                        x.Bin.CurrentOccupancy <= (x.Bin.MaxCapacity * 0.20) &&
                        x.Quantity > 0)
            .ToListAsync(cancellationToken);

        if (!lowStockInventories.Any())
        {
            return Result<int>.Success(0, "Tất cả các ô kệ tiền phương đều đang ở mức an toàn. Không cần nạp thêm.");
        }

        int replenishmentTasksCreated = 0;

        // 2. VÒNG LẶP RÀ SOÁT ĐỊNH TUYẾN NGUỒN CUNG (Replenishment Routing)
        foreach (var targetInv in lowStockInventories)
        {
            if (targetInv.Bin == null) continue;

            // Tính toán lượng không gian trống còn lại cần được bơm đầy của ô kệ đích
            var spaceNeededDouble = targetInv.Bin.MaxCapacity - targetInv.Bin.CurrentOccupancy;
            int quantityNeeded = (int)Math.Floor(spaceNeededDouble); // Ép về số nguyên sản phẩm cần bù

            if (quantityNeeded <= 0) continue;

            // Quét tìm một ô kệ nguồn khác (thuộc khu lưu trữ Bulk) chứa cùng loại sản phẩm, cùng số Lô và còn dồi dào hàng
            var sourceStock = await _context.BinInventories
                .Include(x => x.Bin)
                .Where(x => x.BinId != targetInv.BinId &&
                            x.ProductId == targetInv.ProductId &&
                            x.LotNumber == targetInv.LotNumber &&
                            x.Quantity > quantityNeeded &&
                            x.Status == InventoryStatus.Available)
                .FirstOrDefaultAsync(cancellationToken);

            // Nếu tìm thấy nguồn cung cấp hàng dồi dào, tiến hành luân chuyển nội bộ tự động
            if (sourceStock != null && sourceStock.Bin != null)
            {
                string sourceBinCode = sourceStock.Bin.Code ?? "BULK_ZONE";
                string targetBinCode = targetInv.Bin.Code ?? "PICK_ZONE";

                // Thực thi trừ kho kệ nguồn
                sourceStock.Quantity -= quantityNeeded;
                sourceStock.Bin.CurrentOccupancy -= quantityNeeded;

                // Thực thi cộng dồn kho kệ đích cần bù
                targetInv.Quantity += quantityNeeded;
                targetInv.Bin.CurrentOccupancy += quantityNeeded;

                // ============================================================================
                // 🌟 ĐÃ CẬP NHẬT: GHI NHẬT KÝ KIỂM TOÁN SỔ CÁI KHO (Sử dụng Enum an toàn)
                // ============================================================================
                var transaction = new InventoryTransaction
                {
                    Id = Guid.NewGuid(),
                    ProductId = targetInv.ProductId,
                    // 🚀 KHÔNG CÒN MAGIC STRING: Tự động dịch thành chuỗi "TRANSFER" khớp DB cũ
                    TransactionType = TransactionType.Transfer.ToString().ToUpper(),
                    QuantityChanged = quantityNeeded,
                    SourceBinCode = sourceBinCode,
                    DestinationBinCode = targetBinCode,
                    ReasonCode = "AUTO_REPLENISHMENT",
                    CreatedBy = "WMS_AutoEngine", // Engine chạy ngầm tự động định danh bằng chuỗi riêng biệt
                    CreatedAt = DateTime.UtcNow
                };
                _context.InventoryTransactions.Add(transaction);

                replenishmentTasksCreated++;
            }
        }

        // 4. Đồng bộ Transaction xuống cơ sở dữ liệu nếu có biến động
        if (replenishmentTasksCreated > 0)
        {
            await _context.SaveChangesAsync(cancellationToken);
        }

        return Result<int>.Success(replenishmentTasksCreated, $"Engine đã quét diện rộng và thực thi thành công {replenishmentTasksCreated} lệnh nạp hàng tiền phương.");
    }
}