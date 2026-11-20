using Microsoft.Extensions.Options;
using SmartWMS.Application.Common.Exceptions;
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
        if (_httpClient.Timeout > TimeSpan.FromSeconds(30)) _httpClient.Timeout = TimeSpan.FromSeconds(30);
    }

    public Task<string> GenerateInsightAsync(string prompt) => GenerateInsightAsync(prompt, CancellationToken.None);

    public async Task<string> GenerateInsightAsync(string prompt, CancellationToken ct)
    {
        return await CallGeminiTextApiAsync(_settings.DefaultModel, prompt, ct);
    }

    public Task<string> GenerateExecutiveInsightAsync(string statisticalData) => GenerateExecutiveInsightAsync(statisticalData, CancellationToken.None);

    public async Task<string> GenerateExecutiveInsightAsync(string statisticalData, CancellationToken ct)
    {
        string prompt = $"Bạn là chuyên gia quản lý kho bãi WMS. Dựa trên dữ liệu thống kê sau: {statisticalData}. Hãy đưa ra đánh giá ngắn gọn (khoảng 3-4 câu) và lời khuyên tối ưu vận hành.";
        return await CallGeminiTextApiAsync(_settings.ProModel, prompt, ct);
    }

    public Task<string> AnalyzeReceiptImageAsync(byte[] imageBytes, string mimeType) => AnalyzeReceiptImageAsync(imageBytes, mimeType, CancellationToken.None);

    public async Task<string> AnalyzeReceiptImageAsync(byte[] imageBytes, string mimeType, CancellationToken ct)
    {
        string prompt = "Hãy trích xuất thông tin hóa đơn nhập kho từ hình ảnh này dưới dạng JSON hợp lệ gồm các trường: SupplierName, InvoiceNumber, InvoiceDate (yyyy-MM-dd), Items (mảng gồm SKU, ProductName, Quantity, UnitPrice). Chỉ trả về JSON thuần, không bọc markdown.";
        string rawJson = await CallGeminiVisionApiAsync(_settings.DefaultModel, prompt, imageBytes, mimeType, ct);
        return CleanJsonOutput(rawJson);
    }

    public Task<string> ParseVoiceCommandAsync(string voiceText) => ParseVoiceCommandAsync(voiceText, CancellationToken.None);

    public async Task<string> ParseVoiceCommandAsync(string voiceText, CancellationToken ct)
    {
        string prompt = $"Phân tích câu lệnh giọng nói nhân viên kho: '{voiceText}'. Trả về JSON chứa Action (INBOUND, OUTBOUND, MOVE, COUNT) và parameters đi kèm.";
        string rawJson = await CallGeminiTextApiAsync(_settings.DefaultModel, prompt, ct);
        return CleanJsonOutput(rawJson);
    }

    public Task<string> AnalyzeDamageImageAsync(byte[] imageBytes, string mimeType) => AnalyzeDamageImageAsync(imageBytes, mimeType, CancellationToken.None);

    public async Task<string> AnalyzeDamageImageAsync(byte[] imageBytes, string mimeType, CancellationToken ct)
    {
        string prompt = "Phân tích hình ảnh hàng hóa bị lỗi/hư hỏng. Trả về JSON gồm: DamageType, Severity (Low/Medium/High), DamageDescription, ActionRecommended. Chỉ trả về JSON thuần.";
        string rawJson = await CallGeminiVisionApiAsync(_settings.DefaultModel, prompt, imageBytes, mimeType, ct);
        return CleanJsonOutput(rawJson);
    }

    public Task<string> AnalyzeSlottingOptimizationAsync(string movementDataJson) => AnalyzeSlottingOptimizationAsync(movementDataJson, CancellationToken.None);

    public async Task<string> AnalyzeSlottingOptimizationAsync(string movementDataJson, CancellationToken ct)
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

        string rawJson = await CallGeminiTextApiAsync(_settings.ProModel, prompt, ct);
        return CleanJsonOutput(rawJson);
    }

    public Task<string> PredictDemandAsync(string jsonPayload) => PredictDemandAsync(jsonPayload, CancellationToken.None);

    public async Task<string> PredictDemandAsync(string jsonPayload, CancellationToken ct)
    {
        string prompt = $@"Dựa trên lịch sử xuất kho 90 ngày của sản phẩm: {jsonPayload}.
Hãy dự báo nhu cầu xuất kho trong 30 ngày tới.
SKU phải bằng chính xác SKU trong payload. Chỉ dự báo các ngày từ ForecastStartDate đến ForecastEndDate (bao gồm hai đầu), đúng năm/tháng/ngày trong payload. Không sử dụng ngày hiện tại suy đoán.
Trả về một JSON đối tượng khớp chính xác cấu trúc C# DTO sau:
{{
  ""SKU"": ""string"",
  ""HistoricalMovements"": [ {{ ""Date"": ""yyyy-MM-dd"", ""Quantity"": 0 }} ],
  ""ForecastedDemand"": [ {{ ""Date"": ""yyyy-MM-dd"", ""Quantity"": 0 }} ]
}}
Lưu ý: Chỉ trả về chuỗi JSON thuần, không có ký tự markdown ```json.";

        string rawJson = await CallGeminiTextApiAsync(_settings.ProModel, prompt, ct);
        return CleanJsonOutput(rawJson);
    }

    private async Task<string> CallGeminiTextApiAsync(string model, string prompt, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_settings.ApiKey) || string.IsNullOrWhiteSpace(model)) throw new AiDependencyException("AI_CONFIGURATION_MISSING");
        var url = $"{_settings.BaseUrl.TrimEnd('/')}/models/{model}:generateContent";
        var requestBody = new
        {
            contents = new[]
            {
                new { parts = new[] { new { text = prompt } } }
            }
        };

        using var jsonContent = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
        using var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Add("x-goog-api-key", _settings.ApiKey);
        request.Content = jsonContent;
        using var response = await SendAsync(request, ct);
        response.EnsureSuccessStatusCode();

        var jsonResponse = await response.Content.ReadAsStringAsync(ct);
        return ExtractTextFromGeminiResponse(jsonResponse);
    }

    private async Task<string> CallGeminiVisionApiAsync(string model, string prompt, byte[] imageBytes, string mimeType, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_settings.ApiKey) || string.IsNullOrWhiteSpace(model)) throw new AiDependencyException("AI_CONFIGURATION_MISSING");
        var url = $"{_settings.BaseUrl.TrimEnd('/')}/models/{model}:generateContent";
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

        using var jsonContent = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
        using var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Add("x-goog-api-key", _settings.ApiKey);
        request.Content = jsonContent;
        using var response = await SendAsync(request, ct);
        response.EnsureSuccessStatusCode();

        var jsonResponse = await response.Content.ReadAsStringAsync(ct);
        return ExtractTextFromGeminiResponse(jsonResponse);
    }

    private async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        try { return await _httpClient.SendAsync(request, ct); }
        catch (Polly.CircuitBreaker.BrokenCircuitException) { throw new AiDependencyException("AI_PROVIDER_UNAVAILABLE"); }
    }

    private static string ExtractTextFromGeminiResponse(string jsonResponse)
    {
        try
        {
            using var doc = JsonDocument.Parse(jsonResponse);
            var candidates = doc.RootElement.GetProperty("candidates");
            var text = candidates[0].GetProperty("content").GetProperty("parts")[0].GetProperty("text").GetString();
            if (string.IsNullOrWhiteSpace(text)) throw new AiDependencyException("AI_RESPONSE_INVALID");
            return text;
        }
        catch (Exception ex) when (ex is JsonException or KeyNotFoundException or InvalidOperationException or IndexOutOfRangeException)
        {
            throw new AiDependencyException("AI_RESPONSE_INVALID");
        }
    }
    private static string CleanJsonOutput(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) throw new AiDependencyException("AI_RESPONSE_INVALID");
        var cleaned = raw.Trim();
        if (cleaned.StartsWith("```json")) cleaned = cleaned[7..];
        else if (cleaned.StartsWith("```")) cleaned = cleaned[3..];
        if (cleaned.EndsWith("```")) cleaned = cleaned[..^3];
        return cleaned.Trim();
    }
}
