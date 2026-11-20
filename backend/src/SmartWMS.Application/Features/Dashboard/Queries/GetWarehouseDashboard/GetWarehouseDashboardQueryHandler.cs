using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Dashboard.DTOs.Queries;
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
        // 1. Đếm tổng sản phẩm và ô kệ active
        var totalProducts = await _context.Products
            .AsNoTracking()
            .CountAsync(p => !p.IsDeleted, cancellationToken);

        var totalBins = await _context.Bins
            .AsNoTracking()
            .CountAsync(b => !b.IsDeleted, cancellationToken);

        // 2. Tính tỷ lệ lấp đầy tổng kho
        var bins = await _context.Bins
            .AsNoTracking()
            .Where(b => !b.IsDeleted)
            .Select(b => new { b.MaxCapacity, b.CurrentOccupancy })
            .ToListAsync(cancellationToken);

        double totalMaxCapacity = bins.Sum(b => b.MaxCapacity);
        double totalCurrentOccupancy = bins.Sum(b => b.CurrentOccupancy);

        double globalOccupancyRate = totalMaxCapacity > 0
            ? System.Math.Round((totalCurrentOccupancy / totalMaxCapacity) * 100, 2)
            : 0.0;

        // 3. Truy vấn danh sách cảnh báo tồn kho thấp (< 20 sản phẩm) từ Database
        var lowQuantities = await _context.BinInventories
            .AsNoTracking()
            .Where(inv => inv.Product != null && !inv.Product.IsDeleted)
            .GroupBy(inv => new { inv.ProductId, inv.Product!.SKU, inv.Product.Name })
            .Select(g => new
            {
                ProductId = g.Key.ProductId,
                SKU = g.Key.SKU ?? string.Empty,
                ProductName = g.Key.Name ?? string.Empty,
                CurrentStock = g.Sum(x => (long)x.Quantity)
            })
            .Where(x => x.CurrentStock < 20)
            .Take(10)
            .ToListAsync(cancellationToken);
        var lowStockAlerts = lowQuantities.Select(x => new LowStockAlertDto
        {
            ProductId = x.ProductId, SKU = x.SKU, ProductName = x.ProductName,
            CurrentStock = checked((int)x.CurrentStock)
        }).ToList();

        // 4. Truy vấn 10 giao dịch xuất/nhập/dịch chuyển mới nhất từ Sổ cái
        var recentTransactions = await _context.InventoryTransactions
            .AsNoTracking()
            .Include(t => t.Product)
            .OrderByDescending(t => t.CreatedAt)
            .Take(10)
            .Select(t => new RecentTransactionDto
            {
                SKU = t.Product != null ? t.Product.SKU : "N/A",
                TransactionType = t.TransactionType,
                QuantityChanged = t.QuantityChanged,
                Location = !string.IsNullOrEmpty(t.DestinationBinCode) ? t.DestinationBinCode : t.SourceBinCode,
                CreatedAt = t.CreatedAt
            })
            .ToListAsync(cancellationToken);

        var dto = new WarehouseDashboardDto
        {
            TotalProducts = totalProducts,
            TotalActiveBins = totalBins,
            GlobalOccupancyRate = globalOccupancyRate,
            LowStockAlerts = lowStockAlerts,
            RecentTransactions = recentTransactions
        };

        return Result<WarehouseDashboardDto>.Success(dto, "Lấy dữ liệu Dashboard thực tế thành công.");
    }
}
