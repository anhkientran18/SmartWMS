using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Forecasts.Queries.GetStockForecast.Dtos;

namespace SmartWMS.Application.Features.Forecasts.Queries.GetStockForecast;

public class GetStockForecastQuery : IRequest<Result<StockForecastDto>>
{
    public string SKU { get; set; } = string.Empty;
}