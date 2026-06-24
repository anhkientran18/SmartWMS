using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Dashboard.Queries.GetDashboardInsightQuery.Dtos;

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
        // 1. Lấy dữ liệu thống kê thô từ DB
        var totalProducts = await _context.Products.CountAsync(cancellationToken);
        var totalBins = await _context.Bins.CountAsync(cancellationToken);

        var bins = await _context.Bins.AsNoTracking().ToListAsync(cancellationToken);
        double totalCapacity = bins.Sum(b => b.MaxCapacity);
        double totalOccupancy = bins.Sum(b => b.CurrentOccupancy);

        double occupancyPercentage = totalCapacity > 0 ? Math.Round((totalOccupancy / totalCapacity) * 100, 2) : 0;

        // 2. Gom dữ liệu thành bối cảnh cho AI
        string statsContext = $"Kho đang có {totalProducts} loại sản phẩm, quản lý {totalBins} ô kệ. " +
                              $"Tổng sức chứa toàn kho là {totalCapacity} kiện, hiện đang chứa {totalOccupancy} kiện. " +
                              $"Tỷ lệ lấp đầy toàn kho đạt {occupancyPercentage}%.";

        // 3. Gọi AI phân tích Insight
        string aiInsight = await _aiInsightService.GenerateExecutiveInsightAsync(statsContext);

        // 4. Trả về kết quả cho Dashboard
        var resultDto = new DashboardInsightDto
        {
            TotalProducts = totalProducts,
            TotalBins = totalBins,
            OverallOccupancyPercentage = occupancyPercentage,
            AiExecutiveSummary = aiInsight
        };

        return Result<DashboardInsightDto>.Success(resultDto);
    }
}