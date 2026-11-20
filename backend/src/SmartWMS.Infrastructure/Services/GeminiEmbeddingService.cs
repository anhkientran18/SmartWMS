using Microsoft.Extensions.Options;
using SmartWMS.Application.Common.Exceptions;
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
        if (_httpClient.Timeout > TimeSpan.FromSeconds(30)) _httpClient.Timeout = TimeSpan.FromSeconds(30);
        _settings = options.Value;
    }

    public Task<float[]> GenerateEmbeddingAsync(string text) => GenerateEmbeddingAsync(text, CancellationToken.None);

    public async Task<float[]> GenerateEmbeddingAsync(string text, CancellationToken ct)
    {
        var model = _settings.EmbeddingModel;
        if (string.Equals(model, "text-embedding-004", StringComparison.OrdinalIgnoreCase))
            throw new AiDependencyException("AI_CONFIGURATION_MISSING");
        if (string.IsNullOrWhiteSpace(_settings.ApiKey) || string.IsNullOrWhiteSpace(model))
            throw new AiDependencyException("AI_CONFIGURATION_MISSING");
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
        using var response = await SendAsync(httpRequest, ct);
        response.EnsureSuccessStatusCode();

        var jsonResponse = await response.Content.ReadAsStringAsync(ct);
        try
        {
            using var doc = JsonDocument.Parse(jsonResponse);
            var values = doc.RootElement.GetProperty("embedding").GetProperty("values");
            if (values.ValueKind != JsonValueKind.Array || values.GetArrayLength() != EmbeddingDimensions)
                throw new AiDependencyException("AI_RESPONSE_INVALID");
            var vector = values.EnumerateArray().Select(x => x.GetSingle()).ToArray();
            if (vector.Any(x => !float.IsFinite(x))) throw new AiDependencyException("AI_RESPONSE_INVALID");
            return vector;
        }
        catch (Exception ex) when (ex is JsonException or KeyNotFoundException or InvalidOperationException or FormatException)
        { throw new AiDependencyException("AI_RESPONSE_INVALID"); }
    }
    private async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        try { return await _httpClient.SendAsync(request, ct); }
        catch (Polly.CircuitBreaker.BrokenCircuitException) { throw new AiDependencyException("AI_PROVIDER_UNAVAILABLE"); }
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
