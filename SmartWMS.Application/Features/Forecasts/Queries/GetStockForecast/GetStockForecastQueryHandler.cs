using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Forecasts.DTOs.Queries;
using SmartWMS.Application.Features.InventoryManagement.Specifications.Queries;
using System;
using System.Globalization;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Forecasts.Queries.GetStockForecast;

public class GetStockForecastQueryHandler(IApplicationDbContext context, IAiInsightService aiInsightService)
    : IRequestHandler<GetStockForecastQuery, Result<StockForecastDto>>
{
    public async Task<Result<StockForecastDto>> Handle(GetStockForecastQuery request, CancellationToken cancellationToken)
    {
        var product = await context.Products.AsNoTracking()
            .FirstOrDefaultAsync(p => p.SKU == request.RequestData.Sku && !p.IsDeleted, cancellationToken);
        if (product == null)
            return Result<StockForecastDto>.Failure(ErrorCodeConstants.ProductNotFound, "Không tìm thấy sản phẩm có mã SKU này trên hệ thống.");

        var now = DateTime.UtcNow;
        var demand = new OutboundDemandTransactionsSpec(now.AddDays(-90));
        var dailyTotals = await context.InventoryTransactions.AsNoTracking()
            .Where(demand.Criteria!).Where(t => t.ProductId == product.Id && t.CreatedAt <= now)
            .GroupBy(t => t.CreatedAt.Date)
            .Select(g => new { Date = g.Key, TotalPickedQty = g.Sum(t => -(long)t.QuantityChanged) })
            .OrderBy(x => x.Date)
            .ToListAsync(cancellationToken);
        if (dailyTotals.Count == 0)
            return Result<StockForecastDto>.Failure(ErrorCodeConstants.ValidationError, "Hệ thống chưa có đủ dữ liệu xuất kho của sản phẩm này trong 90 ngày qua để AI tiến hành dự báo.");
        if (dailyTotals.Any(x => x.TotalPickedQty > int.MaxValue))
            return Result<StockForecastDto>.Failure(ErrorCodeConstants.ValidationError, "Daily demand vượt giới hạn quantity của forecast contract.");

        var payload = JsonSerializer.Serialize(new
        {
            SKU = product.SKU,
            ProductName = product.Name,
            ForecastStartDate = now.Date.AddDays(1).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            ForecastEndDate = now.Date.AddDays(30).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            History = dailyTotals.Select(x => new
            {
                Date = x.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                x.TotalPickedQty
            })
        });

        // HTTP/time-out failures propagate to the existing API exception handler; no synthetic forecast.
        try
        {
            var raw = await aiInsightService.PredictDemandAsync(payload, cancellationToken);
            if (string.IsNullOrWhiteSpace(raw)) return InvalidResponse();
            var forecast = JsonSerializer.Deserialize<StockForecastDto>(raw, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
            if (forecast == null || forecast.SKU != product.SKU || forecast.HistoricalMovements == null ||
                forecast.ForecastedDemand == null || forecast.ForecastedDemand.Count == 0 || forecast.ForecastedDemand.Count > 30 || forecast.ForecastedDemand.Any(x => x == null) ||
                forecast.ForecastedDemand.Select(x => x.Date.Date).Distinct().Count() != forecast.ForecastedDemand.Count ||
                forecast.HistoricalMovements.Concat(forecast.ForecastedDemand)
                    .Any(x => x == null || x.Date == default || x.Quantity < 0))
                return InvalidResponse();

            if (forecast.ForecastedDemand.Any(x => x.Date.Date <= now.Date || x.Date.Date > now.Date.AddDays(30))) return InvalidResponse();
            // Historical demand is authoritative database data, never an LLM reconstruction.
            forecast.HistoricalMovements = dailyTotals.Select(x => new SmartWMS.Application.Features.Forecasts.Queries.GetStockForecast.Dtos.ForecastPointDto
                { Date = x.Date, Quantity = (int)x.TotalPickedQty }).ToList();

            return Result<StockForecastDto>.Success(forecast, "Dự báo tồn kho thành công.");
        }
        catch (JsonException)
        {
            return InvalidResponse();
        }
    }

    private static Result<StockForecastDto> InvalidResponse() =>
        Result<StockForecastDto>.Failure("AI_RESPONSE_INVALID", "Phản hồi AI không khớp dữ liệu dự báo hợp lệ.");
}
