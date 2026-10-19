using MediatR;
using SmartWMS.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InventoryManagement.DTOs.Queries;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.InventoryManagement.Queries.GetInventorySummary;

public class GetInventorySummaryQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetInventorySummaryQuery, Result<InventorySummaryDto>>
{
    public async Task<Result<InventorySummaryDto>> Handle(GetInventorySummaryQuery request, CancellationToken cancellationToken)
    {
        var productQuantities = await context.BinInventories
            .AsNoTracking()
            .Where(x => x.Product != null && !x.Product.IsDeleted)
            .GroupBy(x => x.ProductId)
            .Select(g => g.Sum(x => x.Quantity))
            .ToListAsync(cancellationToken);

        var summary = new InventorySummaryDto
        {
            TotalProducts = productQuantities.Count,
            TotalQuantity = productQuantities.Sum(),
            LowStockItems = productQuantities.Count(quantity => quantity < 20)
        };

        return Result<InventorySummaryDto>.Success(summary);
    }
}
