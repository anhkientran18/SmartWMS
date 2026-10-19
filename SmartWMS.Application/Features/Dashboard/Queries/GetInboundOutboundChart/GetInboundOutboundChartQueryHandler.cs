using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Dashboard.DTOs.Queries;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Dashboard.Queries.GetInboundOutboundChart;

public class GetInboundOutboundChartQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetInboundOutboundChartQuery, Result<List<InboundOutboundChartPointDto>>>
{
    public async Task<Result<List<InboundOutboundChartPointDto>>> Handle(GetInboundOutboundChartQuery request, CancellationToken cancellationToken)
    {
        var today = DateTime.UtcNow.Date;
        var start = today.AddDays(1 - request.Days);
        var end = today.AddDays(1);
        var dailyTotals = await context.InventoryTransactions.AsNoTracking()
            .Where(x => x.CreatedAt >= start && x.CreatedAt < end &&
                (x.TransactionType == "INBOUND" || x.TransactionType == "OUTBOUND" ||
                 x.TransactionType == "WAVE_OUTBOUND" || x.TransactionType == "OUTBOUND_SERIAL"))
            .GroupBy(x => x.CreatedAt.Date)
            .Select(g => new InboundOutboundChartPointDto
            {
                DateUtc = g.Key,
                InboundQuantity = g.Sum(x => x.TransactionType == "INBOUND" ? Math.Abs((long)x.QuantityChanged) : 0L),
                OutboundQuantity = g.Sum(x => x.TransactionType != "INBOUND" ? Math.Abs((long)x.QuantityChanged) : 0L)
            })
            .ToDictionaryAsync(x => x.DateUtc, cancellationToken);

        var points = new List<InboundOutboundChartPointDto>(request.Days);
        for (var date = start; date < end; date = date.AddDays(1))
        {
            dailyTotals.TryGetValue(date, out var total);
            points.Add(new InboundOutboundChartPointDto
            {
                DateUtc = date,
                InboundQuantity = total?.InboundQuantity ?? 0,
                OutboundQuantity = total?.OutboundQuantity ?? 0
            });
        }

        return Result<List<InboundOutboundChartPointDto>>.Success(points);
    }
}
