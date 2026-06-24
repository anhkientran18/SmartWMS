using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.OutboundIssues.Dtos;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.OutboundIssues.Queries;

public class GetOptimizedWavePickingQueryHandler : IRequestHandler<GetOptimizedWavePickingQuery, Result<WavePickingDto>>
{
    private readonly IApplicationDbContext _context;

    public GetOptimizedWavePickingQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<WavePickingDto>> Handle(GetOptimizedWavePickingQuery request, CancellationToken cancellationToken)
    {
        // ============================================================================
        // 🌟 ĐÃ SỬA: Thu thập và làm phẳng danh sách mặt hàng từ bảng chi tiết Items con
        // Kết hợp trích xuất Id của phiếu xuất cha (IssueId) và thông tin Product từ bảng con.
        // ============================================================================
        var pendingItems = await _context.OutboundIssues
            .AsNoTracking()
            .Where(x => request.OrderIds.Contains(x.Id))
            .SelectMany(issue => issue.Items.Select(item => new
            {
                IssueId = issue.Id,
                item.ProductId,
                item.Quantity,
                Product = item.Product
            }))
            .ToListAsync(cancellationToken);

        if (!pendingItems.Any())
        {
            return Result<WavePickingDto>.Failure("Không tìm thấy các mặt hàng hợp lệ trong các đơn hàng đã chọn.");
        }

        // ============================================================================
        // 🌟 ĐÃ SỬA: Gom nhóm các sản phẩm trùng nhau dựa trên tập dữ liệu đã làm phẳng
        // ============================================================================
        var groupedItems = pendingItems
            .GroupBy(x => x.ProductId)
            .Select(g => new
            {
                ProductId = g.Key,
                Product = g.First().Product,
                TotalQty = g.Sum(x => x.Quantity),
                OrderIds = g.Select(x => x.IssueId).Distinct().ToList()
            }).ToList();

        var waveRoute = new List<PickingItemDto>();

        // 3. Phân bổ vị trí ô kệ (Bin) cho từng sản phẩm dựa trên chiến lược FEFO (Hạn dùng gần xuất trước)
        foreach (var item in groupedItems)
        {
            if (item.Product == null) continue;

            var stockLocation = await _context.BinInventories
                .Include(x => x.Bin)
                .Where(x => x.ProductId == item.ProductId
                         && x.Quantity >= item.TotalQty
                         && x.Status == Domain.Enums.InventoryStatus.Available)
                .OrderBy(x => x.ExpirationDate)
                .FirstOrDefaultAsync(cancellationToken);

            if (stockLocation == null || stockLocation.Bin == null)
            {
                return Result<WavePickingDto>.Failure($"Mặt hàng {item.Product.SKU} không đủ tồn kho khả dụng trên toàn hệ thống để phân bổ lệnh nhặt hàng.");
            }

            waveRoute.Add(new PickingItemDto
            {
                ProductId = item.ProductId,
                ProductName = item.Product.Name,
                SKU = item.Product.SKU,
                BinCode = stockLocation.Bin.Code,
                TotalQuantityToPick = item.TotalQty,
                AssociatedOrderIds = item.OrderIds
            });
        }

        // 4. THUẬT TOÁN S-SHAPE ROUTING: Sắp xếp thứ tự các ô kệ di chuyển tối ưu ziczac
        var optimizedRoute = waveRoute.OrderBy(item =>
        {
            var parts = item.BinCode.Split('-');
            if (parts.Length >= 3)
            {
                string zone = parts[0];
                string rackStr = parts[2].Replace("R", "");
                string levelStr = parts.Length > 3 ? parts[3].Replace("L", "") : "1";

                if (int.TryParse(rackStr, out int rackId) && int.TryParse(levelStr, out int levelId))
                {
                    if (rackId % 2 == 0)
                    {
                        return (Zone: zone, Rack: rackId, Cost: 1000 - levelId);
                    }
                    return (Zone: zone, Rack: rackId, Cost: levelId);
                }
            }
            return (Zone: "Z", Rack: 99, Cost: 99);
        }).ToList();

        var result = new WavePickingDto
        {
            WaveId = Guid.NewGuid(),
            OptimizedRoute = optimizedRoute
        };

        return Result<WavePickingDto>.Success(result);
    }
}