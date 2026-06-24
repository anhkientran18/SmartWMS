using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using SmartWMS.Application.Common.Interfaces;

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

    // Đổi tên hàm thành AskGeminiWithContextAsync để hiện thực hóa chính xác Interface mới
    public async Task<string> AskGeminiWithContextAsync(string userMessage, string contextData)
    {
        try
        {
            // Tích hợp chỉ thị hệ thống chuyên nghiệp cho Tác nhân ảo SmartWMS [cite: 26, 42, 540]
             string systemInstruction = "Bạn là SmartWMS Virtual Agent, một trợ lý ảo thông minh phụ trách quản lý kho hàng[cite: 26, 42, 540]. " +
                                       "Hãy sử dụng dữ liệu kho bãi thời gian thực được cung cấp để trả lời một cách ngắn gọn, chính xác bằng Tiếng Việt. " +
                                       "Định dạng kết quả bằng Markdown sạch sẽ.";

            string finalPrompt = $"{systemInstruction}\n\n[DỮ LIỆU KHO THỰC TẾ]:\n{contextData}\n\n[CÂU HỎI NGƯỜI DÙNG]:\n{userMessage}";

            var requestBody = new
            {
                contents = new[] { new { parts = new[] { new { text = finalPrompt } } } }
            };

            string apiKey = _configuration["GeminiSettings:ApiKey"] ?? string.Empty;
            var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key={apiKey}";

            var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync(url, content);

            if (response.IsSuccessStatusCode)
            {
                var responseString = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(responseString);
                return doc.RootElement.GetProperty("candidates")[0]
                    .GetProperty("content").GetProperty("parts")[0]
                    .GetProperty("text").GetString()?.Trim() ?? "Không nhận được phản hồi từ AI Agent.";
            }
        }
        catch (Exception ex)
        {
            return $"Lỗi hệ thống AI: {ex.Message}";
        }

        return "Hệ thống AI tạm thời không thể xử lý yêu cầu lúc này.";
    }
}