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
        var alerts = await context.BinInventories
            .AsNoTracking()
            .Where(x => x.Product != null && !x.Product.IsDeleted)
            .GroupBy(x => new { x.ProductId, x.Product.SKU, x.Product.Name })
            .Select(g => new LowStockAlertDto
            {
                ProductId = g.Key.ProductId,
                SKU = g.Key.SKU,
                ProductName = g.Key.Name,
                CurrentStock = g.Sum(x => x.Quantity)
            })
            .Where(x => x.CurrentStock < 20)
            .OrderBy(x => x.CurrentStock)
            .ThenBy(x => x.SKU)
            .ThenBy(x => x.ProductId)
            .ToListAsync(cancellationToken);

        return Result<List<LowStockAlertDto>>.Success(alerts);
    }
}
