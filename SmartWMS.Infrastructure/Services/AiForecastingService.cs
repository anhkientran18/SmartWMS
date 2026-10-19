using SmartWMS.Application.Common.Interfaces;

namespace SmartWMS.Infrastructure.Services;

public class AiForecastingService : IAiForecastingService
{
    private readonly HttpClient _httpClient;

    public AiForecastingService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<string> PredictDemandAsync(string jsonPayload)
    {
        // Logic dự báo AI ở đây
        return await Task.FromResult(string.Empty);
    }
}