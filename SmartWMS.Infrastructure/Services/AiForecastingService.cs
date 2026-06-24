using System;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using SmartWMS.Application.Common.Interfaces;

namespace SmartWMS.Infrastructure.Services;

public class AiForecastingService : IAiForecastingService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;

    public AiForecastingService(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _configuration = configuration;
    }

    public async Task<string> Get30DaysDemandForecastAsync(string historicalDataJson)
    {
        try
        {
            // Thiết lập Endpoint kết nối sang Python Engine hoặc API của Cloud
            string forecastApiUrl = _configuration["AiSettings:PythonForecastingUrl"] ?? "http://localhost:5000/api/v1/forecast";

            var content = new StringContent(historicalDataJson, Encoding.UTF8, "application/json");

            // Thực thi gửi dữ liệu chuỗi thời gian (Time-series data)
            var response = await _httpClient.PostAsync(forecastApiUrl, content);

            if (response.IsSuccessStatusCode)
            {
                return await response.Content.ReadAsStringAsync();
            }
        }
        catch (Exception ex)
        {
            return $"{{\"Error\": \"Không thể kết nối với Engine dự báo chuỗi thời gian: {ex.Message}\"}}";
        }

        return "{\"Error\": \"Hệ thống xử lý dự báo xu hướng đang bận.\"}";
    }
}