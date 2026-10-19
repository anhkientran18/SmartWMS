using Microsoft.Extensions.Options;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models.Configurations;
using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace SmartWMS.Infrastructure.Services;

public class GeminiInsightService : IAiInsightService
{
    private readonly HttpClient _httpClient;
    private readonly GeminiSettings _settings;

    public GeminiInsightService(HttpClient httpClient, IOptions<GeminiSettings> options)
    {
        _httpClient = httpClient;
        _settings = options.Value;
    }

    public async Task<string> GenerateInsightAsync(string prompt)
    {
        return await CallGeminiTextApiAsync(_settings.DefaultModel, prompt);
    }

    public async Task<string> GenerateExecutiveInsightAsync(string statisticalData)
    {
        string prompt = $"Bạn là chuyên gia quản lý kho bãi WMS. Dựa trên dữ liệu thống kê sau: {statisticalData}. Hãy đưa ra đánh giá ngắn gọn (khoảng 3-4 câu) và lời khuyên tối ưu vận hành.";
        return await CallGeminiTextApiAsync(_settings.ProModel, prompt);
    }

    public async Task<string> AnalyzeReceiptImageAsync(byte[] imageBytes, string mimeType)
    {
        string prompt = "Hãy trích xuất thông tin hóa đơn nhập kho từ hình ảnh này dưới dạng JSON hợp lệ gồm các trường: SupplierName, InvoiceNumber, InvoiceDate (yyyy-MM-dd), Items (mảng gồm SKU, ProductName, Quantity, UnitPrice). Chỉ trả về JSON thuần, không bọc markdown.";
        string rawJson = await CallGeminiVisionApiAsync(_settings.DefaultModel, prompt, imageBytes, mimeType);
        return CleanJsonOutput(rawJson);
    }

    public async Task<string> ParseVoiceCommandAsync(string voiceText)
    {
        string prompt = $"Phân tích câu lệnh giọng nói nhân viên kho: '{voiceText}'. Trả về JSON chứa Action (INBOUND, OUTBOUND, MOVE, COUNT) và parameters đi kèm.";
        string rawJson = await CallGeminiTextApiAsync(_settings.DefaultModel, prompt);
        return CleanJsonOutput(rawJson);
    }

    public async Task<string> AnalyzeDamageImageAsync(byte[] imageBytes, string mimeType)
    {
        string prompt = "Phân tích hình ảnh hàng hóa bị lỗi/hư hỏng. Trả về JSON gồm: DamageType, Severity (Low/Medium/High), DamageDescription, ActionRecommended. Chỉ trả về JSON thuần.";
        string rawJson = await CallGeminiVisionApiAsync(_settings.DefaultModel, prompt, imageBytes, mimeType);
        return CleanJsonOutput(rawJson);
    }

    public async Task<string> AnalyzeSlottingOptimizationAsync(string movementDataJson)
    {
        string prompt = $@"Dựa trên dữ liệu biến động tồn kho 30 ngày qua: {movementDataJson}.
Hãy đề xuất sắp xếp lại vị trí hàng hóa (Slotting Optimization) để tối ưu quãng đường di chuyển.
Trả về một JSON Array chứa danh sách đối tượng:
[
  {{
    ""SKU"": ""string"",
    ""ProductName"": ""string"",
    ""CurrentZone"": ""string"",
    ""SuggestedZone"": ""string"",
    ""VelocityClass"": ""Fast/Medium/Slow"",
    ""AIReasoning"": ""string""
  }}
]
Lưu ý: Chỉ trả về chuỗi JSON Array thuần, không có ký tự markdown ```json.";

        string rawJson = await CallGeminiTextApiAsync(_settings.ProModel, prompt);
        return CleanJsonOutput(rawJson);
    }

    public async Task<string> PredictDemandAsync(string jsonPayload)
    {
        string prompt = $@"Dựa trên lịch sử xuất kho 90 ngày của sản phẩm: {jsonPayload}.
Hãy dự báo nhu cầu xuất kho trong 30 ngày tới.
Trả về một JSON đối tượng khớp chính xác cấu trúc C# DTO sau:
{{
  ""SKU"": ""string"",
  ""HistoricalMovements"": [ {{ ""Date"": ""yyyy-MM-dd"", ""Quantity"": 0 }} ],
  ""ForecastedDemand"": [ {{ ""Date"": ""yyyy-MM-dd"", ""Quantity"": 0 }} ]
}}
Lưu ý: Chỉ trả về chuỗi JSON thuần, không có ký tự markdown ```json.";

        string rawJson = await CallGeminiTextApiAsync(_settings.ProModel, prompt);
        return CleanJsonOutput(rawJson);
    }

    private async Task<string> CallGeminiTextApiAsync(string model, string prompt)
    {
        var url = $"{_settings.BaseUrl}/models/{model}:generateContent?key={_settings.ApiKey}";
        var requestBody = new
        {
            contents = new[]
            {
                new { parts = new[] { new { text = prompt } } }
            }
        };

        var jsonContent = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
        var response = await _httpClient.PostAsync(url, jsonContent);
        response.EnsureSuccessStatusCode();

        var jsonResponse = await response.Content.ReadAsStringAsync();
        return ExtractTextFromGeminiResponse(jsonResponse);
    }

    private async Task<string> CallGeminiVisionApiAsync(string model, string prompt, byte[] imageBytes, string mimeType)
    {
        var url = $"{_settings.BaseUrl}/models/{model}:generateContent?key={_settings.ApiKey}";
        string base64Image = Convert.ToBase64String(imageBytes);

        var requestBody = new
        {
            contents = new[]
            {
                new
                {
                    parts = new object[]
                    {
                        new { text = prompt },
                        new
                        {
                            inlineData = new
                            {
                                mimeType = string.IsNullOrWhiteSpace(mimeType) ? "image/jpeg" : mimeType,
                                data = base64Image
                            }
                        }
                    }
                }
            }
        };

        var jsonContent = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
        var response = await _httpClient.PostAsync(url, jsonContent);
        response.EnsureSuccessStatusCode();

        var jsonResponse = await response.Content.ReadAsStringAsync();
        return ExtractTextFromGeminiResponse(jsonResponse);
    }

    private static string ExtractTextFromGeminiResponse(string jsonResponse)
    {
        using var doc = JsonDocument.Parse(jsonResponse);
        var root = doc.RootElement;
        if (root.TryGetProperty("candidates", out var candidates) && candidates.GetArrayLength() > 0)
        {
            var parts = candidates[0].GetProperty("content").GetProperty("parts");
            if (parts.GetArrayLength() > 0)
            {
                return parts[0].GetProperty("text").GetString() ?? string.Empty;
            }
        }
        return string.Empty;
    }

    private static string CleanJsonOutput(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return "{}";
        var cleaned = raw.Trim();
        if (cleaned.StartsWith("```json")) cleaned = cleaned[7..];
        else if (cleaned.StartsWith("```")) cleaned = cleaned[3..];
        if (cleaned.EndsWith("```")) cleaned = cleaned[..^3];
        return cleaned.Trim();
    }
}