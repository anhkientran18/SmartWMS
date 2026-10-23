using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Dashboard.DTOs.Queries;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Dashboard.Queries.GetDashboardInsightQuery;

public class GetDashboardInsightQueryHandler : IRequestHandler<GetDashboardInsightQuery, Result<DashboardInsightDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly IAiInsightService _aiInsightService;

    public GetDashboardInsightQueryHandler(IApplicationDbContext context, IAiInsightService aiInsightService)
    {
        _context = context;
        _aiInsightService = aiInsightService;
    }

    public async Task<Result<DashboardInsightDto>> Handle(GetDashboardInsightQuery request, CancellationToken cancellationToken)
    {
        var totalProducts = await _context.Products.AsNoTracking().CountAsync(p => !p.IsDeleted, cancellationToken);
        var totalBins = await _context.Bins.AsNoTracking().CountAsync(b => !b.IsDeleted, cancellationToken);

        var bins = await _context.Bins
            .AsNoTracking()
            .Where(b => !b.IsDeleted)
            .Select(b => new { b.MaxCapacity, b.CurrentOccupancy })
            .ToListAsync(cancellationToken);

        double totalMaxCapacity = bins.Sum(b => b.MaxCapacity);
        double totalCurrentOccupancy = bins.Sum(b => b.CurrentOccupancy);

        double occupancyRate = totalMaxCapacity > 0
            ? System.Math.Round((totalCurrentOccupancy / totalMaxCapacity) * 100, 2)
            : 0.0;

        string statisticalData = $"Tổng sản phẩm: {totalProducts}, Tổng số ô kệ: {totalBins}, Tỷ lệ lấp đầy kho: {occupancyRate}%.";

        string aiSummary = string.Empty;
        string? aiError = null;
        try { aiSummary = await _aiInsightService.GenerateExecutiveInsightAsync(statisticalData, cancellationToken); }
        catch (Exception ex) when (ex is SmartWMS.Application.Common.Exceptions.AiDependencyException or HttpRequestException or TimeoutException ||
            ex is OperationCanceledException && !cancellationToken.IsCancellationRequested)
        { aiError = "AI_UNAVAILABLE"; }

        var resultDto = new DashboardInsightDto
        {
            TotalProducts = totalProducts,
            TotalBins = totalBins,
            OverallOccupancyPercentage = occupancyRate,
            AiExecutiveSummary = aiSummary,
            AiAvailable = !string.IsNullOrWhiteSpace(aiSummary),
            AiErrorCode = aiError ?? (string.IsNullOrWhiteSpace(aiSummary) ? "AI_RESPONSE_INVALID" : null)
        };

        return Result<DashboardInsightDto>.Success(resultDto, "Tạo phân tích AI Dashboard thành công.");
    }
}
