using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Dashboard.DTOs.Queries;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.InventoryManagement.Queries.GetLowStockAlerts;

public class GetLowStockAlertsQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetLowStockAlertsQuery, Result<List<LowStockAlertDto>>>
{
    public async Task<Result<List<LowStockAlertDto>>> Handle(GetLowStockAlertsQuery request, CancellationToken cancellationToken)
    {
        var lowQuantities = await context.BinInventories
            .AsNoTracking()
            .Where(x => x.Product != null && !x.Product.IsDeleted)
            .GroupBy(x => new { x.ProductId, x.Product.SKU, x.Product.Name })
            .Select(g => new
            {
                ProductId = g.Key.ProductId,
                SKU = g.Key.SKU,
                ProductName = g.Key.Name,
                CurrentStock = g.Sum(x => (long)x.Quantity)
            })
            .Where(x => x.CurrentStock < 20)
            .OrderBy(x => x.CurrentStock)
            .ThenBy(x => x.SKU)
            .ThenBy(x => x.ProductId)
            .ToListAsync(cancellationToken);

        // Valid stock quantities are nonnegative and the SQL filter guarantees totals <20.
        // Keep the existing low-stock DTO while widening the aggregation before filtering.
        var alerts = lowQuantities.Select(x => new LowStockAlertDto
        {
            ProductId = x.ProductId, SKU = x.SKU, ProductName = x.ProductName,
            CurrentStock = checked((int)x.CurrentStock)
        }).ToList();

        return Result<List<LowStockAlertDto>>.Success(alerts);
    }
}
