using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Dashboard.Queries.GetWarehouseDashboard.Dtos;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Dashboard.Queries.GetWarehouseDashboard;

public class GetWarehouseDashboardQueryHandler : IRequestHandler<GetWarehouseDashboardQuery, Result<WarehouseDashboardDto>>
{
    private readonly IApplicationDbContext _context;

    public GetWarehouseDashboardQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<WarehouseDashboardDto>> Handle(GetWarehouseDashboardQuery request, CancellationToken cancellationToken)
    {
        var dto = new WarehouseDashboardDto();

        // 1. Thu thập các chỉ số đếm cơ bản (Master Data Counters)
        dto.TotalProducts = await _context.Products.CountAsync(cancellationToken);

        var activeBins = await _context.Bins
            .Where(b => !b.IsDeleted)
            .ToListAsync(cancellationToken);

        dto.TotalActiveBins = activeBins.Count;

        // 2. Tính toán tỷ lệ lấp đầy hình học tổng kho (Global Occupancy Rate)
        double totalMaxCapacity = activeBins.Sum(b => b.MaxCapacity);
        double totalCurrentOccupancy = activeBins.Sum(b => b.CurrentOccupancy);

        dto.GlobalOccupancyRate = totalMaxCapacity > 0
            ? Math.Round((totalCurrentOccupancy / totalMaxCapacity) * 100, 2)
            : 0;

        // 3. Quét hệ thống tìm kiếm hàng có nguy cơ đứt gãy chuỗi cung ứng (Tồn kho < 10 đơn vị)
        dto.LowStockAlerts = await _context.BinInventories
            .Include(x => x.Product)
            .Where(x => x.Bin != null && !x.Bin.IsDeleted)
            .GroupBy(x => new { x.ProductId, x.Product!.SKU, x.Product.Name })
            .Select(g => new LowStockAlertDto
            {
                ProductId = g.Key.ProductId,
                SKU = g.Key.SKU ?? string.Empty,
                ProductName = g.Key.Name ?? string.Empty,
                CurrentStock = g.Sum(x => x.Quantity)
            })
            .Where(x => x.CurrentStock <= 10)
            .Take(5) // Khống chế lấy 5 mặt hàng nguy cấp nhất
            .ToListAsync(cancellationToken);

        // 4. Trích xuất 5 vết giao dịch biến động số cơ sở sổ cái kho mới nhất (Audit Trail)
        dto.RecentTransactions = await _context.InventoryTransactions
            .Include(t => t.Product)
            .OrderByDescending(t => t.CreatedAt)
            .Take(5)
            .Select(t => new RecentTransactionDto
            {
                SKU = t.Product != null ? t.Product.SKU : "SYSTEM",
                TransactionType = t.TransactionType ?? "UNKNOWN",
                QuantityChanged = t.QuantityChanged,
                Location = t.SourceBinCode ?? "N/A",
                CreatedAt = t.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return Result<WarehouseDashboardDto>.Success(dto);
    }
}