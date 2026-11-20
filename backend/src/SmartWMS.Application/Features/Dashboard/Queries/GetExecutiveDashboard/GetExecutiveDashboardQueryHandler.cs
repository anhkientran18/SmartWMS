using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Dashboard.DTOs.Queries;
using SmartWMS.Application.Features.InventoryManagement.Queries.GetInventorySummary;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using InsightQuery = SmartWMS.Application.Features.Dashboard.Queries.GetDashboardInsightQuery.GetDashboardInsightQuery;
using WarehouseQuery = SmartWMS.Application.Features.Dashboard.Queries.GetWarehouseDashboard.GetWarehouseDashboardQuery;

namespace SmartWMS.Application.Features.Dashboard.Queries.GetExecutiveDashboard;

public class GetExecutiveDashboardQueryHandler(ISender sender, IApplicationDbContext context)
    : IRequestHandler<GetExecutiveDashboardQuery, Result<ExecutiveDashboardDto>>
{
    public async Task<Result<ExecutiveDashboardDto>> Handle(GetExecutiveDashboardQuery request, CancellationToken cancellationToken)
    {
        var warehouse = await sender.Send(new WarehouseQuery(new WarehouseDashboardQueryRequest()), cancellationToken);
        if (!warehouse.IsSuccess)
            return Result<ExecutiveDashboardDto>.Failure(warehouse.Error?.Code ?? "ERR_GENERAL", warehouse.Error?.Message ?? warehouse.Message ?? "Không thể đọc dữ liệu kho.");

        var inventory = await sender.Send(new GetInventorySummaryQuery(), cancellationToken);
        if (!inventory.IsSuccess)
            return Result<ExecutiveDashboardDto>.Failure(inventory.Error?.Code ?? "ERR_GENERAL", inventory.Error?.Message ?? inventory.Message ?? "Không thể đọc tồn kho.");

        var inbound = await context.InboundReceipts.AsNoTracking()
            .Where(x => !x.IsDeleted)
            .GroupBy(x => x.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Status, x => x.Count, cancellationToken);

        var outbound = await context.OutboundIssues.AsNoTracking()
            .Where(x => !x.IsDeleted)
            .GroupBy(x => x.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Status, x => x.Count, cancellationToken);

        var insight = await sender.Send(new InsightQuery(new DashboardInsightQueryRequest()), cancellationToken);
        if (!insight.IsSuccess)
            return Result<ExecutiveDashboardDto>.Failure(insight.Error?.Code ?? "ERR_GENERAL", insight.Error?.Message ?? insight.Message ?? "Không thể đọc AI insight.");

        return Result<ExecutiveDashboardDto>.Success(new ExecutiveDashboardDto
        {
            Warehouse = warehouse.Data!,
            Inventory = inventory.Data!,
            InboundReceiptsByStatus = inbound,
            OutboundOrdersByStatus = outbound,
            AiInsight = insight.Data!
        });
    }
}
