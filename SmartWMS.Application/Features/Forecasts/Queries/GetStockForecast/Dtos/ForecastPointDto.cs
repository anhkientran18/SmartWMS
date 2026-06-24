using System;

namespace SmartWMS.Application.Features.Forecasts.Queries.GetStockForecast.Dtos;

public class ForecastPointDto
{
    public DateTime Date { get; set; }
    public int Quantity { get; set; }
}