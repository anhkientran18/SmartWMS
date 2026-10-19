using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InventoryManagement.DTOs.Queries;
using SmartWMS.Application.Features.InventoryManagement.Specifications.Queries;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.InventoryManagement.Queries.GetSlottingRecommendations;

public class GetSlottingRecommendationsQueryHandler(IApplicationDbContext context, IAiInsightService aiInsightService)
    : IRequestHandler<GetSlottingRecommendationsQuery, Result<List<SlottingRecommendationDto>>>
{
    public async Task<Result<List<SlottingRecommendationDto>>> Handle(GetSlottingRecommendationsQuery request, CancellationToken cancellationToken)
    {
        var zoneId = request.RequestData.ZoneId;
        if (zoneId.HasValue && (zoneId.Value == Guid.Empty || !await context.Zones.AsNoTracking()
            .AnyAsync(x => x.Id == zoneId.Value && !x.IsDeleted && !x.Warehouse.IsDeleted, cancellationToken)))
            return Result<List<SlottingRecommendationDto>>.Failure(ErrorCodeConstants.ValidationError, "Zone không tồn tại hoặc không còn hoạt động.");

        var stockQuery = context.BinInventories.AsNoTracking()
            .Include(x => x.Product).Include(x => x.Bin).ThenInclude(x => x!.Zone)
            .Where(x => x.Product != null && !x.Product.IsDeleted && x.Bin != null && !x.Bin.IsDeleted &&
                x.Bin.Zone != null && !x.Bin.Zone.IsDeleted && !x.Bin.Zone.Warehouse.IsDeleted);
        if (zoneId.HasValue)
            stockQuery = stockQuery.Where(x => x.Bin!.ZoneId == zoneId.Value);

        var demand = new OutboundDemandTransactionsSpec(DateTime.UtcNow.AddDays(-30));
        var movements = context.InventoryTransactions.AsNoTracking().Where(demand.Criteria!)
            .Where(x => x.Product != null && !x.Product.IsDeleted);
        if (zoneId.HasValue)
        {
            // Scope both the product population and the historical source bin, not just the displayed locations.
            var zoneBinCodes = context.Bins.Where(x => x.ZoneId == zoneId.Value && !x.IsDeleted).Select(x => x.Code);
            movements = movements.Where(t => stockQuery.Any(s => s.ProductId == t.ProductId) &&
                zoneBinCodes.Contains(t.SourceBinCode));
        }

        var movementData = await movements.GroupBy(t => new { t.ProductId, t.Product!.SKU, t.Product.Name })
            .Select(g => new
            {
                g.Key.ProductId,
                g.Key.SKU,
                g.Key.Name,
                TotalPickedQty = g.Sum(t => -(long)t.QuantityChanged),
                TransactionCount = g.Count()
            }).OrderByDescending(x => x.TransactionCount).ThenBy(x => x.SKU)
            .ToListAsync(cancellationToken);
        if (movementData.Count == 0)
            return Result<List<SlottingRecommendationDto>>.Failure(ErrorCodeConstants.ValidationError,
                "Chưa có dữ liệu xuất kho phù hợp trong 30 ngày cho phạm vi Slotting được chọn.");

        var currentLocations = await stockQuery.ToListAsync(cancellationToken);
        var payload = JsonSerializer.Serialize(movementData.Select(m => new
        {
            m.SKU,
            m.Name,
            m.TotalPickedQty,
            m.TransactionCount,
            CurrentZones = currentLocations.Where(s => s.ProductId == m.ProductId)
                .Select(s => s.Bin!.Zone!.Name).Distinct().ToList()
        }));

        try
        {
            var raw = await aiInsightService.AnalyzeSlottingOptimizationAsync(payload);
            if (string.IsNullOrWhiteSpace(raw)) return InvalidResponse();
            var recommendations = JsonSerializer.Deserialize<List<SlottingRecommendationDto>>(raw, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
            if (recommendations == null || recommendations.Any(x => x == null || !movementData.Any(m => m.SKU == x.SKU)))
                return InvalidResponse();

            return Result<List<SlottingRecommendationDto>>.Success(recommendations, "Đã phân tích Slotting khuyến nghị.");
        }
        catch (JsonException)
        {
            return InvalidResponse();
        }
    }

    private static Result<List<SlottingRecommendationDto>> InvalidResponse() =>
        Result<List<SlottingRecommendationDto>>.Failure("AI_RESPONSE_INVALID", "Phản hồi AI không khớp dữ liệu hoặc phạm vi Slotting.");
}
