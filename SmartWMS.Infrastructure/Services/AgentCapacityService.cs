using System.Text;
using System.Text.Json;
using SmartWMS.Application.Common.Interfaces;

namespace SmartWMS.Infrastructure.Services;

public class AgentCapacityService : IAgentCapacityService
{
    private readonly HttpClient _httpClient;

    public AgentCapacityService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<int> SuggestOptimizeCapacityAsync(double width, double height, double depth)
    {
        try
        {
            // Thiết lập cấu trúc Prompt thông minh gửi cho LLM (Gemini)
            var prompt = $"Bạn là kỹ sư tối ưu hóa kho hàng. Một ô kệ có kích thước: Rộng {width}cm, Cao {height}cm, Sâu {depth}cm. " +
                         $"Giả sử thùng hàng tiêu chuẩn có kích thước 30x30x30 cm và cần chừa lại 10% không gian an toàn thao tác. " +
                         $"Hãy tính toán toán học và CHỈ TRẢ VỀ MỘT SỐ NGUYÊN DUY NHẤT là số lượng thùng tối đa xếp vừa. Không giải thích gì thêm.";

            var requestBody = new
            {
                contents = new[] { new { parts = new[] { new { text = prompt } } } }
            };

            // Điền API Key Gemini của bạn vào đây (Hoặc cấu hình từ appsettings.json)
            string apiKey = "YOUR_GEMINI_API_KEY";
            var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key={apiKey}";

            var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync(url, content);

            if (response.IsSuccessStatusCode)
            {
                var responseString = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(responseString);
                var aiResponseText = doc.RootElement
                    .GetProperty("candidates")[0]
                    .GetProperty("content")
                    .GetProperty("parts")[0]
                    .GetProperty("text").GetString()?.Trim();

                // Chuyển kết quả chuỗi số nguyên từ AI về kiểu int
                if (int.TryParse(aiResponseText, out int capacity))
                {
                    return capacity;
                }
            }
        }
        catch
        {
            // Luồng dự phòng (Fallback) nếu mất kết nối mạng hoặc lỗi API Key: Tính toán hình học cơ bản
            return (int)((width * height * depth) / (30 * 30 * 30) * 0.9);
        }

        return 50; // Giá trị mặc định nền nếu toàn bộ luồng gặp lỗi
    }
}