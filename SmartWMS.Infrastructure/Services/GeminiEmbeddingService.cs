using Microsoft.Extensions.Options;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models.Configurations;
using System;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace SmartWMS.Infrastructure.Services;

public class GeminiEmbeddingService : IEmbeddingService
{
    private const int EmbeddingDimensions = 768;
    private readonly HttpClient _httpClient;
    private readonly GeminiSettings _settings;

    public GeminiEmbeddingService(HttpClient httpClient, IOptions<GeminiSettings> options)
    {
        _httpClient = httpClient;
        _settings = options.Value;
    }

    public async Task<float[]> GenerateEmbeddingAsync(string text)
    {
        var model = _settings.EmbeddingModel;
        if (string.Equals(model, "text-embedding-004", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("text-embedding-004 đã ngừng sử dụng. Cấu hình GeminiSettings:EmbeddingModel thành gemini-embedding-001.");
        if (string.IsNullOrWhiteSpace(_settings.ApiKey))
            throw new InvalidOperationException("GeminiSettings:ApiKey chưa được cấu hình.");
        var url = $"{_settings.BaseUrl.TrimEnd('/')}/models/{model}:embedContent";

        var requestBody = new
        {
            model = $"models/{model}",
            outputDimensionality = EmbeddingDimensions,
            content = new
            {
                parts = new[] { new { text } }
            }
        };

        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, url);
        httpRequest.Headers.Add("x-goog-api-key", _settings.ApiKey);
        httpRequest.Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
        using var response = await _httpClient.SendAsync(httpRequest);
        response.EnsureSuccessStatusCode();

        var jsonResponse = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(jsonResponse);

        var valuesElement = doc.RootElement.GetProperty("embedding").GetProperty("values");
        if (valuesElement.ValueKind != JsonValueKind.Array || valuesElement.GetArrayLength() != EmbeddingDimensions)
            throw new InvalidOperationException($"Embedding phải có đúng {EmbeddingDimensions} dimensions; không trả vector sai kích thước cho caller.");
        float[] vector = new float[valuesElement.GetArrayLength()];
        int index = 0;
        foreach (var val in valuesElement.EnumerateArray())
        {
            var value = val.GetSingle();
            if (!float.IsFinite(value))
                throw new InvalidOperationException("Embedding chứa giá trị không hữu hạn.");
            vector[index++] = value;
        }

        return vector;
    }

    public double CalculateCosineSimilarity(float[] vectorA, float[] vectorB)
    {
        if (vectorA == null || vectorB == null || vectorA.Length != vectorB.Length) return 0;

        double dotProduct = 0.0;
        double normA = 0.0;
        double normB = 0.0;

        for (int i = 0; i < vectorA.Length; i++)
        {
            dotProduct += vectorA[i] * vectorB[i];
            normA += vectorA[i] * vectorA[i];
            normB += vectorB[i] * vectorB[i];
        }

        if (normA == 0 || normB == 0) return 0;
        return dotProduct / (Math.Sqrt(normA) * Math.Sqrt(normB));
    }
}