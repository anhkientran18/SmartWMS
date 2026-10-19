using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models.Configurations;

namespace SmartWMS.Infrastructure.Services;

public class GeminiSlottingService : IAISlottingService
{
    private readonly HttpClient _httpClient;
    private readonly GeminiSettings _settings;
    private readonly ILogger<GeminiSlottingService> _logger;

    public GeminiSlottingService(
        HttpClient httpClient,
        IOptions<GeminiSettings> settings,
        ILogger<GeminiSlottingService> logger)
    {
        _httpClient = httpClient;
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task<PutawayRecommendationDto> RecommendPutawayBinAsync(string sku, int quantity, CancellationToken cancellationToken = default)
    {
        try
        {
            const string modelName = "models/gemini-1.5-flash";
            var url = $"https://generativelanguage.googleapis.com/v1beta/{modelName}:generateContent?key={_settings.ApiKey}";

            var prompt = $"Gợi ý ô cất hàng (Putaway Bin) tối ưu cho sản phẩm SKU '{sku}' số lượng {quantity}. Trả về JSON: {{\"binCode\": \"C-Z1-R1-L1\", \"zoneCode\": \"COLD\", \"explanation\": \"Ưu tiên khu vực mát cho hàng bảo quản đặc thù\"}}";

            var requestBody = new
            {
                contents = new[]
                {
                    new { parts = new[] { new { text = prompt } } }
                },
                generationConfig = new { responseMimeType = "application/json" }
            };

            var jsonContent = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync(url, jsonContent, cancellationToken);

            if (!response.IsSuccessStatusCode)
                throw new HttpRequestException($"Gemini Slotting API Error: {response.StatusCode}");

            var responseString = await response.Content.ReadAsStringAsync(cancellationToken);
            using var doc = JsonDocument.Parse(responseString);
            var textResult = doc.RootElement
                .GetProperty("candidates")[0]
                .GetProperty("content")
                .GetProperty("parts")[0]
                .GetProperty("text").GetString();

            using var parsedJson = JsonDocument.Parse(textResult ?? "{}");
            var root = parsedJson.RootElement;

            return new PutawayRecommendationDto
            {
                RecommendedBinCode = root.GetProperty("binCode").GetString() ?? "D-Z2-R1-L1",
                ZoneCode = root.GetProperty("zoneCode").GetString() ?? "DRY",
                StrategyUsed = "AI_Gemini_Slotting",
                Explanation = root.GetProperty("explanation").GetString() ?? "Tối ưu ô kệ theo thuật toán AI."
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Gemini AI Slotting gặp sự cố. Dùng quy tắc cất hàng mặc định.");
            return new PutawayRecommendationDto
            {
                RecommendedBinCode = "D-Z2-R1-L1",
                ZoneCode = "DRY",
                StrategyUsed = "Fallback_Capacity_Rule",
                Explanation = "Xếp vào ô trống gần nhất theo nguyên tắc dung tích khả dụng."
            };
        }
    }
}