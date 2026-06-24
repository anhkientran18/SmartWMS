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

namespace SmartWMS.Application.Features.InventoryManagement.Commands.MoveLpn;

public class MoveLpnCommandHandler : IRequestHandler<MoveLpnCommand, Result<bool>>
{
    private readonly IApplicationDbContext _context;
    private readonly IMediator _mediator;

    public MoveLpnCommandHandler(IApplicationDbContext context, IMediator mediator)
    {
        _context = context;
        _mediator = mediator;
    }

    public async Task<Result<bool>> Handle(MoveLpnCommand request, CancellationToken cancellationToken)
    {
        // 1. Truy tìm toàn bộ danh mục hàng hóa đang nằm trên thùng tổng/Pallet này
        var lpnStocks = await _context.BinInventories
            .Include(x => x.Bin)
            .Where(x => x.LpnCode == request.LpnCode && x.Quantity > 0)
            .ToListAsync(cancellationToken);

        if (!lpnStocks.Any())
        {
            return Result<bool>.Failure($"Không tìm thấy bất kỳ mặt hàng khả dụng nào gắn với mã kiện/Pallet ({request.LpnCode}) trong kho.");
        }

        // 2. Xác thực điều kiện ô kệ đích đến
        var targetBin = await _context.Bins
            .FirstOrDefaultAsync(b => b.Id == request.ToBinId && !b.IsDeleted, cancellationToken);

        if (targetBin == null)
        {
            return Result<bool>.Failure("Vị trí ô kệ đích được chỉ định không tồn tại trên sơ đồ kho bãi.");
        }

        int totalWeightToMove = lpnStocks.Sum(x => x.Quantity);
        if ((targetBin.CurrentOccupancy + totalWeightToMove) > targetBin.MaxCapacity)
        {
            return Result<bool>.Failure($"Quá tải! Ô kệ đích {targetBin.Code} không đủ sức chứa cho toàn bộ cấu kiện Pallet này (Thiếu hụt tải trọng).");
        }

        var sourceBinCode = lpnStocks.First().Bin?.Code ?? "UNKNOWN";
        var fromBinId = lpnStocks.First().BinId;

        // 3. THỰC THI DỊCH CHUYỂN HÀNG LOẠT (BULK TRANSACTION UPDATE)
        foreach (var stock in lpnStocks)
        {
            // Trừ dung lượng ô kệ cũ
            if (stock.Bin != null)
            {
                stock.Bin.CurrentOccupancy -= stock.Quantity;
            }

            // Gắn vị trí ô kệ mới cho dòng tồn kho của kiện hàng
            stock.BinId = request.ToBinId;

            // Ghi nhận lịch sử kiểm toán biến động (Inventory Audit Trail)
            _context.InventoryTransactions.Add(new InventoryTransaction
            {
                Id = Guid.NewGuid(),
                ProductId = stock.ProductId,
                TransactionType = "LPN_BULK_MOVE",
                QuantityChanged = stock.Quantity,
                SourceBinCode = sourceBinCode,
                DestinationBinCode = targetBin.Code ?? "UNKNOWN",
                ReasonCode = $"LPN_MOVEMENT_{request.LpnCode}",
                CreatedBy = "WMS_LpnEngine",
                CreatedAt = DateTime.UtcNow
            });
        }

        // Cập nhật tăng tải trọng lấp đầy hình học cho kệ đích đến
        targetBin.CurrentOccupancy += totalWeightToMove;

        // Lưu đồng bộ toàn vẹn dữ liệu xuống SQL Server
        await _context.SaveChangesAsync(cancellationToken);

        // 4. PHÁT SÓNG REAL-TIME ĐỒNG BỘ MÀN HÌNH THEO DÕI SƠ ĐỒ KHO
        await _mediator.Publish(new InventoryChangedEvent
        {
            EventType = "LPN_MOVED",
            Message = $"Toàn bộ kiện hàng/Pallet mang mã {request.LpnCode} (gồm {totalWeightToMove} sản phẩm) đã được dịch chuyển thành công từ ô kệ {sourceBinCode} sang ô kệ {targetBin.Code}."
        }, cancellationToken);

        return Result<bool>.Success(true, $"Đã dịch chuyển nguyên cấu kiện Pallet {request.LpnCode} tới ô vị trí kệ {targetBin.Code} thành công gọn gàng.");
    }
}