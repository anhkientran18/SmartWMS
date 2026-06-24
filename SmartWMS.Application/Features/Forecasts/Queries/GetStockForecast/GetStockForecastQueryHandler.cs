using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Forecasts.Queries.GetStockForecast.Dtos;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Forecasts.Queries.GetStockForecast;

public class GetStockForecastQueryHandler : IRequestHandler<GetStockForecastQuery, Result<StockForecastDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly IAiForecastingService _forecastingService;

    public GetStockForecastQueryHandler(IApplicationDbContext context, IAiForecastingService forecastingService)
    {
        _context = context;
        _forecastingService = forecastingService;
    }

    public async Task<Result<StockForecastDto>> Handle(GetStockForecastQuery request, CancellationToken cancellationToken)
    {
        // 1. Kiểm tra sản phẩm tồn tại trong danh mục hệ thống
        var productExists = await _context.Products
            .AnyAsync(p => p.SKU == request.SKU, cancellationToken);

        if (!productExists)
        {
            return Result<StockForecastDto>.Failure($"Không tìm thấy sản phẩm có mã SKU: {request.SKU}");
        }

        // ============================================================================
        // 🌟 ĐÃ SỬA: Thu thập lịch sử xuất kho thông qua bảng chi tiết 1-N (SelectMany)
        // Kiên dùng cách này để bóc tách đúng số lượng từ bảng con và ngày từ bảng cha.
        // ============================================================================
        var historicalMovements = await _context.OutboundIssues
            .AsNoTracking()
            .SelectMany(issue => issue.Items
                .Where(item => item.Product != null && item.Product.SKU == request.SKU)
                .Select(item => new ForecastPointDto
                {
                    Date = issue.CreatedAt,  // Lấy mốc thời gian xuất kho thực tế từ phiếu cha
                    Quantity = item.Quantity // Lấy số lượng xuất thực tế từ bảng chi tiết con
                }))
            .ToListAsync(cancellationToken);
        // ============================================================================

        // 3. Đóng gói dữ liệu lịch sử thành chuỗi JSON sạch để gửi sang Python Microservice
        var payload = new
        {
            Sku = request.SKU,
            HistoricalMovements = historicalMovements.Select(m => new { m.Date, m.Quantity })
        };

        string historicalDataJson = JsonSerializer.Serialize(payload);

        // 4. Gọi Service kết nối AI nhận chuỗi kết quả tính toán mô hình Time-series từ Python
        string forecastJsonResult = await _forecastingService.Get30DaysDemandForecastAsync(historicalDataJson);

        // 5. Giải mã chuỗi JSON từ Python ngược về bộ DTO định kiểu tĩnh cho C#
        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        var forecastedPoints = JsonSerializer.Deserialize<List<ForecastPointDto>>(forecastJsonResult, options) ?? new();

        var finalResult = new StockForecastDto
        {
            SKU = request.SKU,
            HistoricalMovements = historicalMovements,
            ForecastedDemand = forecastedPoints
        };

        return Result<StockForecastDto>.Success(finalResult);
    }
}