using System.Text;
using System.Text.Json;
using SmartWMS.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;

namespace SmartWMS.Infrastructure.Services;

public class GeminiChatService : IAiChatService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;

    public GeminiChatService(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _configuration = configuration;
    }

    public async Task<string> AskGeminiWithContextAsync(string userMessage, string warehouseContext)
    {
        try
        {
            // Thiết lập cấu hình hệ thống (System Instruction) lồng ngữ cảnh RAG vào
            string systemInstruction = $"Bạn là Trợ lý ảo thông minh tích hợp trong hệ thống quản lý kho SmartWMS. {warehouseContext}";

            var requestBody = new
            {
                contents = new[]
                {
                    new { parts = new[] { new { text = userMessage } } }
                },
                systemInstruction = new
                {
                    parts = new[] { new { text = systemInstruction } }
                },
                generationConfig = new
                {
                    temperature = 0.3 // Để nhiệt độ thấp giúp AI trả về câu trả lời chính xác, tránh "ảo tưởng"
                }
            };

            // Lấy API Key từ cấu hình hệ thống appsettings.json
            string apiKey = _configuration["GeminiSettings:ApiKey"] ?? "YOUR_GEMINI_API_KEY_FALLBACK";
            var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key={apiKey}";

            var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync(url, content);

            if (response.IsSuccessStatusCode)
            {
                var responseString = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(responseString);

                return doc.RootElement
                    .GetProperty("candidates")[0]
                    .GetProperty("content")
                    .GetProperty("parts")[0]
                    .GetProperty("text").GetString()?.Trim() ?? "Không thể phân tích phản hồi từ AI.";
            }

            return $"Lỗi kết nối AI: {response.StatusCode}";
        }
        catch (Exception ex)
        {
            return $"Đã xảy ra lỗi khi xử lý trợ lý ảo: {ex.Message}";
        }
    }
}