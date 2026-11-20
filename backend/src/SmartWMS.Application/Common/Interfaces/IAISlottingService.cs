using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Common.Interfaces;

public interface IAISlottingService
{
    /// <summary>
    /// Gợi ý ô kệ (Bin) tối ưu nhất để cất hàng dựa trên kích thước, nhiệt độ, tần suất nhập xuất
    /// </summary>
    Task<PutawayRecommendationDto> RecommendPutawayBinAsync(string sku, int quantity, CancellationToken cancellationToken = default);
}

public class PutawayRecommendationDto
{
    public string RecommendedBinCode { get; set; } = string.Empty;
    public string ZoneCode { get; set; } = string.Empty;
    public string StrategyUsed { get; set; } = "AI_Gemini_Pro"; // "AI_Gemini_Pro" hoặc "Fallback_FIFO_Capacity"
    public string Explanation { get; set; } = string.Empty;
}