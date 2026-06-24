using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InventoryManagement.Queries.GetSlottingRecommendations.Dtos;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.InventoryManagement.Queries.GetSlottingRecommendations;

public class GetSlottingRecommendationsQueryHandler : IRequestHandler<GetSlottingRecommendationsQuery, Result<List<SlottingRecommendationDto>>>
{
    private readonly IApplicationDbContext _context;
    private readonly IAiInsightService _aiInsightService;

    public GetSlottingRecommendationsQueryHandler(IApplicationDbContext context, IAiInsightService aiInsightService)
    {
        _context = context;
        _aiInsightService = aiInsightService;
    }

    public async Task<Result<List<SlottingRecommendationDto>>> Handle(GetSlottingRecommendationsQuery request, CancellationToken cancellationToken)
    {
        var thirtyDaysAgo = DateTime.UtcNow.AddDays(-30);

        // 1. Thu thập dữ liệu biến động tần suất bốc hàng thực tế trong 30 ngày qua (Outbound Transactions)
        var movementData = await _context.InventoryTransactions
            .Where(t => t.CreatedAt >= thirtyDaysAgo && (t.TransactionType == "OUTBOUND" || t.TransactionType == "WAVE_OUTBOUND"))
            .GroupBy(t => new { t.ProductId, t.Product!.SKU, t.Product.Name })
            .Select(g => new
            {
                g.Key.SKU,
                g.Key.Name,
                TotalPickedQty = Math.Abs(g.Sum(t => t.QuantityChanged)),
                TransactionCount = g.Count()
            })
            .OrderByDescending(x => x.TransactionCount)
            .ToListAsync(cancellationToken);

        if (!movementData.Any())
        {
            return Result<List<SlottingRecommendationDto>>.Failure("Hệ thống chưa tích lũy đủ dữ liệu giao dịch xuất kho trong vòng 30 ngày để AI tiến hành phân tích Slotting.");
        }

        // 2. Lấy thông tin sơ đồ vùng chứa hiện tại của các sản phẩm để đối chiếu cấu trúc hình học
        var currentStockLocations = await _context.BinInventories
            .Include(x => x.Product)
            .Include(x => x.Bin).ThenInclude(b => b!.Zone)
            .Where(x => x.Bin != null && x.Bin.Zone != null && x.Product != null)
            .ToListAsync(cancellationToken);

        // 3. Tạo Payload nén dữ liệu sạch gửi lên AI làm căn cứ quyết định layout
        var aiPayload = movementData.Select(m => new
        {
            m.SKU,
            m.Name,
            m.TotalPickedQty,
            m.TransactionCount,
            CurrentZones = currentStockLocations
                .Where(s => s.Product!.SKU == m.SKU)
                .Select(s => s.Bin!.Zone!.Name)
                .Distinct()
                .ToList()
        }).ToList();

        string jsonPayload = JsonSerializer.Serialize(aiPayload);

        // 4. Triệu hồi bộ não AI Gemini bóc tách và phân phối lại vị trí kệ hàng tối ưu
        string aiRawResult = await _aiInsightService.AnalyzeSlottingOptimizationAsync(jsonPayload);

        try
        {
            var recommendations = JsonSerializer.Deserialize<List<SlottingRecommendationDto>>(aiRawResult, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            return Result<List<SlottingRecommendationDto>>.Success(
                recommendations ?? new List<SlottingRecommendationDto>(),
                "AI đã hoàn tất càn quét lịch sử giao dịch và xuất sơ đồ Slotting khuyến nghị thành công.");
        }
        catch (JsonException)
        {
            return Result<List<SlottingRecommendationDto>>.Failure("Định dạng phản hồi từ cấu trúc dịch vụ AI không khớp với mô hình dữ liệu Slotting JSON mong đợi.");
        }
    }
}