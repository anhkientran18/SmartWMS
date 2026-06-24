using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Options; // BỔ SUNG: Thư viện xử lý Options Pattern
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models.Configurations; // BỔ SUNG: Namespace chứa lớp GeminiSettings bảo mật

namespace SmartWMS.Infrastructure.Services;

public class GeminiEmbeddingService : IEmbeddingService
{
    private readonly HttpClient _httpClient;
    private readonly GeminiSettings _geminiSettings; // ĐÃ SỬA: Thay đổi từ IConfiguration sang strongly-typed object

    // Constructor nhận vào IOptions để đồng bộ bảo mật hạ tầng thông minh doanh nghiệp
    public GeminiEmbeddingService(HttpClient httpClient, IOptions<GeminiSettings> geminiOptions)
    {
        _httpClient = httpClient;
        _geminiSettings = geminiOptions.Value; // Trích xuất giá trị an toàn từ bộ nạp cấu hình
    }

    // ============================================================================
    // 1. GENERATE EMBEDDING: Số hóa văn bản thành mảng các số thực (768 chiều dữ liệu)
    // ============================================================================
    public async Task<float[]> GenerateEmbeddingAsync(string text)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(text))
            {
                return new float[768];
            }

            // Cấu trúc Request Body chuẩn hóa dành cho mô hình text-embedding-004 của Google
            var requestBody = new
            {
                content = new { parts = new[] { new { text = text } } }
            };

            string apiKey = _geminiSettings.ApiKey; // ĐÃ SỬA: Lấy từ thuộc tính cấu hình an toàn, chống lộ lọt key
            var url = $"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={apiKey}";

            var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync(url, content);

            if (response.IsSuccessStatusCode)
            {
                var responseString = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(responseString);

                // Bóc tách mảng "values" nằm bên trong đối tượng "embedding" của JSON trả về
                var valuesArray = doc.RootElement
                    .GetProperty("embedding")
                    .GetProperty("values");

                var vector = new float[valuesArray.GetArrayLength()];
                int index = 0;

                foreach (var value in valuesArray.EnumerateArray())
                {
                    vector[index++] = value.GetSingle();
                }

                return vector;
            }
        }
        catch (Exception)
        {
            // Trả về mảng mặc định được bảo vệ bởi cơ chế phục hồi ngắt mạch Polly nếu xảy ra sự cố mạng
        }

        return new float[768]; // Trả về mảng 768 chiều mặc định của mô hình text-embedding-004
    }

    // ============================================================================
    // 2. COSINE SIMILARITY: Thuật toán so khớp khoảng cách hình học giữa hai Vector ngữ nghĩa
    // ============================================================================
    public double CalculateCosineSimilarity(float[] vectorA, float[] vectorB)
    {
        // Nếu hai Vector không đồng nhất về số chiều không gian (Dimension), độ tương đồng bằng 0
        if (vectorA == null || vectorB == null || vectorA.Length != vectorB.Length)
            return 0.0;

        double dotProduct = 0.0;
        double normA = 0.0;
        double normB = 0.0;

        // Tính toán tích vô hướng và độ dài vector hình học
        for (int i = 0; i < vectorA.Length; i++)
        {
            dotProduct += vectorA[i] * vectorB[i];
            normA += Math.Pow(vectorA[i], 2);
            normB += Math.Pow(vectorB[i], 2);
        }

        // Phòng tránh lỗi chia cho số 0 (Division by zero) trong toán học hình học
        if (normA == 0.0 || normB == 0.0)
            return 0.0;

        return dotProduct / (Math.Sqrt(normA) * Math.Sqrt(normB));
    }
}