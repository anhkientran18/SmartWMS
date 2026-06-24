using System.Collections.Generic;

namespace SmartWMS.Application.Features.Forecasts.Queries.GetStockForecast.Dtos;

public class StockForecastDto
{
    public string SKU { get; set; } = string.Empty;

    // Chuỗi dữ liệu lịch sử thực tế trong quá khứ
    public List<ForecastPointDto> HistoricalMovements { get; set; } = new();

    // Chuỗi dữ liệu dự báo 30 ngày tới do mô hình Python tính toán
    public List<ForecastPointDto> ForecastedDemand { get; set; } = new();
}