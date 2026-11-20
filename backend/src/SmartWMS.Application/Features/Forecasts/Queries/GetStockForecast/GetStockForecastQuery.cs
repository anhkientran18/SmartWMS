using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Forecasts.DTOs.Queries;

namespace SmartWMS.Application.Features.Forecasts.Queries.GetStockForecast;

// Thay đổi Result<string> thành Result<StockForecastDto>
public record GetStockForecastQuery(StockForecastRequest RequestData) : IRequest<Result<StockForecastDto>>;