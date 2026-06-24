using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using SmartWMS.Application.Common.Models.Configurations;
using System;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Infrastructure.HealthChecks;

// ============================================================================
// Bộ kiểm tra sức khỏe kết nối hạ tầng API Google Gemini thời gian thực
// ============================================================================
public class GeminiHealthCheck : IHealthCheck
{
    private readonly HttpClient _httpClient;
    private readonly GeminiSettings _geminiSettings;

    public GeminiHealthCheck(HttpClient httpClient, IOptions<GeminiSettings> geminiOptions)
    {
        _httpClient = httpClient;
        _geminiSettings = geminiOptions.Value;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(_geminiSettings.ApiKey))
            {
                return HealthCheckResult.Unhealthy("Gemini API Key đang để trống trong cấu hình hệ thống.");
            }

            // Gửi một truy vấn ping siêu nhẹ tới endpoint của Google để kiểm tra kết nối vật lý và API Key
            string url = $"https://generativelanguage.googleapis.com/v1beta/models?key={_geminiSettings.ApiKey}";

            var response = await _httpClient.GetAsync(url, cancellationToken);

            if (response.IsSuccessStatusCode)
            {
                return HealthCheckResult.Healthy("Kết nối tới máy chủ Google Gemini thông suốt, API Key hợp lệ.");
            }

            return HealthCheckResult.Degraded($"Máy chủ Google trả về mã lỗi HTTP: {response.StatusCode}");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("Không thể kết nối vật lý tới máy chủ AI (Có thể do rớt mạng hoặc tường lửa).", ex);
        }
    }
}