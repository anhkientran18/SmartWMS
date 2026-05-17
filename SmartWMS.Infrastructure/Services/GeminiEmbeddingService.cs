using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using SmartWMS.Application.Common.Interfaces;

namespace SmartWMS.Infrastructure.Services;

public class GeminiEmbeddingService : IEmbeddingService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;

    public GeminiEmbeddingService(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _configuration = configuration;
    }

    public async Task<float[]> GenerateEmbeddingAsync(string text)
    {
        try
        {
            var requestBody = new
            {
                model = "models/text-embedding-004",
                content = new { parts = new[] { new { text = text } } }
            };

            string apiKey = _configuration["GeminiSettings:ApiKey"] ?? "YOUR_GEMINI_API_KEY";
            var url = $"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={apiKey}";

            var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync(url, content);

            if (response.IsSuccessStatusCode)
            {
                var responseString = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(responseString);

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
        catch
        {
            // Trả về vector rỗng hoặc fallback nếu có sự cố mạng
        }

        return new float[768]; // Trả về mảng mặc định theo kích thước chuẩn của mô hình
    }

    // Thuật toán so khớp Cosine Similarity kinh điển của AI Vector Search
    public double CalculateCosineSimilarity(float[] vectorA, float[] vectorB)
    {
        if (vectorA.Length != vectorB.Length) return 0.0;

        double dotProduct = 0.0;
        double normA = 0.0;
        double normB = 0.0;

        for (int i = 0; i < vectorA.Length; i++)
        {
            dotProduct += vectorA[i] * vectorB[i];
            normA += Math.Pow(vectorA[i], 2);
            normB += Math.Pow(vectorB[i], 2);
        }

        if (normA == 0.0 || normB == 0.0) return 0.0;

        return dotProduct / (Math.Sqrt(normA) * Math.Sqrt(normB));
    }
}