using MediatR;
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
    private readonly GeminiSettings _geminiSettings;

    // Constructor nhận vào IOptions để giải phóng sự phụ thuộc vào file appsettings thô
    public GeminiInsightService(HttpClient httpClient, IOptions<GeminiSettings> geminiOptions)
    {
        _httpClient = httpClient;
        _geminiSettings = geminiOptions.Value; // Trích xuất giá trị cấu hình an toàn
    }

    public async Task<string> GenerateInsightAsync(string prompt)
    {
        try
        {
            var requestBody = new { contents = new[] { new { parts = new[] { new { text = prompt } } } } };
            string apiKey = _geminiSettings.ApiKey;

            var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key={apiKey}";
            var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync(url, content);

            if (response.IsSuccessStatusCode)
            {
                var responseString = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(responseString);
                return doc.RootElement.GetProperty("candidates")[0].GetProperty("content").GetProperty("parts")[0].GetProperty("text").GetString()?.Trim() ?? "";
            }
        }
        catch { }
        return "Lỗi phân tích cú pháp AI.";
    }

    public async Task<string> GenerateExecutiveInsightAsync(string statisticalData)
    {
        var executivePrompt = $"Bạn là Giám đốc vận hành kho (COO). Dựa trên số liệu sau: '{statisticalData}'. " +
                              $"Hãy viết MỘT đoạn văn ngắn (khoảng 3-4 câu) phân tích tình hình và đưa ra cảnh báo hoặc lời khuyên quản trị. " +
                              $"Văn phong chuyên nghiệp, tập trung vào tối ưu hóa không gian và an toàn tồn kho.";
        return await GenerateInsightAsync(executivePrompt);
    }

    public async Task<string> AnalyzeReceiptImageAsync(byte[] imageBytes, string mimeType)
    {
        try
        {
            string base64Image = Convert.ToBase64String(imageBytes);
            string systemInstruction = "Bạn là chuyên gia OCR của hệ thống kho SmartWMS. Hãy phân tích hình ảnh hóa đơn này " +
                                       "và trích xuất danh sách sản phẩm thành dạng JSON thô thuần túy.";

            var requestBody = new
            {
                contents = new[]
                {
                    new
                    {
                        parts = new object[]
                        {
                            new { text = systemInstruction },
                            new { inline_data = new { mime_type = mimeType, data = base64Image } }
                        }
                    }
                }
            };

            string apiKey = _geminiSettings.ApiKey;
            var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={apiKey}";
            var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync(url, content);

            if (response.IsSuccessStatusCode)
            {
                var responseString = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(responseString);
                string aiTextResult = doc.RootElement.GetProperty("candidates")[0].GetProperty("content").GetProperty("parts")[0].GetProperty("text").GetString()?.Trim() ?? "{}";
                if (aiTextResult.StartsWith("```")) aiTextResult = aiTextResult.Replace("```json", "").Replace("```", "").Trim();
                return aiTextResult;
            }
        }
        catch (Exception ex) { return $"{{\"Error\": \"Lỗi: {ex.Message}\"}}"; }
        return "{\"Error\": \"Lỗi kết nối AI Vision.\"}";
    }

    public async Task<string> ParseVoiceCommandAsync(string voiceText)
    {
        try
        {
            string systemInstruction = "Bạn là bộ xử lý ngôn ngữ tự nhiên (NLP) của hệ thống kho SmartWMS. Phân tích khẩu lệnh và trả về JSON thuần.";
            string finalPrompt = $"{systemInstruction}\n\n[KHẨU LỆNH]: \"{voiceText}\"";
            var requestBody = new { contents = new[] { new { parts = new[] { new { text = finalPrompt } } } } };

            string apiKey = _geminiSettings.ApiKey;
            // ĐÃ SỬA: Loại bỏ liên kết Markdown lỗi để định dạng chính xác URL endpoint API của Google
            var url = $"[https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=](https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=){apiKey}";
            var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync(url, content);

            if (response.IsSuccessStatusCode)
            {
                var responseString = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(responseString);
                string jsonResult = doc.RootElement.GetProperty("candidates")[0].GetProperty("content").GetProperty("parts")[0].GetProperty("text").GetString()?.Trim() ?? "{}";
                if (jsonResult.StartsWith("```")) jsonResult = jsonResult.Replace("```json", "").Replace("```", "").Trim();
                return jsonResult;
            }
        }
        catch (Exception ex) { return $"{{\"Error\": \"Lỗi: {ex.Message}\"}}"; }
        return "{\"Error\": \"Lỗi kết nối AI Engine.\"}";
    }

    public async Task<string> AnalyzeDamageImageAsync(byte[] imageBytes, string mimeType)
    {
        try
        {
            string base64Image = Convert.ToBase64String(imageBytes);
            string systemInstruction = "Bạn là chuyên gia kiểm định chất lượng (QC) hình ảnh của SmartWMS. Hãy phân tích hình ảnh sản phẩm lỗi này.";

            var requestBody = new
            {
                contents = new object[]
                {
                    new
                    {
                        parts = new object[]
                        {
                            new { text = systemInstruction },
                            new { inline_data = new { mime_type = mimeType, data = base64Image } }
                        }
                    }
                }
            };

            string apiKey = _geminiSettings.ApiKey;
            var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={apiKey}";
            var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync(url, content);

            if (response.IsSuccessStatusCode)
            {
                var responseString = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(responseString);
                string aiTextResult = doc.RootElement.GetProperty("candidates")[0].GetProperty("content").GetProperty("parts")[0].GetProperty("text").GetString()?.Trim() ?? "{}";
                if (aiTextResult.StartsWith("```")) aiTextResult = aiTextResult.Replace("```json", "").Replace("```", "").Trim();
                return aiTextResult;
            }
        }
        catch (Exception ex) { return $"{{\"Error\": \"Lỗi phân tích Computer Vision: {ex.Message}\"}}"; }
        return "{\"Error\": \"Không thể kết nối dịch vụ kiểm tra hình ảnh AI.\"}";
    }

    /// <summary>
    /// BỔ SUNG MỚI: Triệu hồi AI Gemini phân tích lịch sử bốc hàng và đề xuất sơ đồ Slotting tối ưu vị trí ô kệ kho bãi
    /// </summary>
    public async Task<string> AnalyzeSlottingOptimizationAsync(string movementDataJson)
    {
        try
        {
            string systemInstruction = "Bạn là một chuyên gia tối ưu hóa bố trí kho vận (Warehouse Slotting Expert). " +
                                       "Hãy phân tích chuỗi dữ liệu JSON chứa lịch sử bốc hàng (tần suất, số lượng) và sơ đồ vị trí hiện tại được cung cấp. " +
                                       "Phân loại hàng hóa theo mô hình ABC: Nhóm A (Bán chạy, tần suất cao), Nhóm B (Trung bình), Nhóm C (Tồn chậm). " +
                                       "Đưa ra khuyến nghị: Nhóm A phải xếp ở 'Khu Mát (Cold Zone)' hoặc khu gần cửa xuất để đi nhanh, nhóm C xếp vào 'Khu Khô (Dry Zone)' hoặc góc sâu. " +
                                       "BẮT BUỘC chỉ trả về chuỗi JSON nguyên bản là một mảng các đối tượng, KHÔNG ĐƯỢC bọc trong ký tự hiển thị mã nguồn như ```json, KHÔNG ĐƯỢC có văn bản giải thích thừa. " +
                                       "Cấu trúc JSON đầu ra bắt buộc phải khớp chính xác 100% với định dạng này: " +
                                       "[{\"SKU\":\"Mã\",\"ProductName\":\"Tên\",\"CurrentZone\":\"Vùng Cũ\",\"SuggestedZone\":\"Vùng Mới\",\"VelocityClass\":\"A\",\"AIReasoning\":\"Lý do ngắn gọn\"}]";

            var requestBody = new
            {
                contents = new[]
                {
                    new { parts = new[] { new { text = $"{systemInstruction}\n\nĐây là dữ liệu kho thực tế cần xử lý:\n{movementDataJson}" } } }
                },
                generationConfig = new
                {
                    temperature = 0.2,
                    topP = 0.8
                }
            };

            string apiKey = _geminiSettings.ApiKey;
            var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={apiKey}";
            var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync(url, content);

            if (response.IsSuccessStatusCode)
            {
                var responseString = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(responseString);
                string aiTextResult = doc.RootElement.GetProperty("candidates")[0].GetProperty("content").GetProperty("parts")[0].GetProperty("text").GetString()?.Trim() ?? "[]";
                if (aiTextResult.StartsWith("```")) aiTextResult = aiTextResult.Replace("```json", "").Replace("```", "").Trim();
                return aiTextResult;
            }
        }
        catch (Exception ex) { return $"{{\"Error\": \"Lỗi phân tích AI Slotting: {ex.Message}\"}}"; }
        return "[]";
    }
}