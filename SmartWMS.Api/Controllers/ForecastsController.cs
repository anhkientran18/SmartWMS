using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartWMS.Application.Features.Forecasts.DTOs.Queries;
using SmartWMS.Application.Features.Forecasts.Queries.GetStockForecast;
using SmartWMS.Api.Extensions;
using System.Threading.Tasks;

namespace SmartWMS.Api.Controllers;

[Authorize(Roles = "Admin,WarehouseManager")]
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public class ForecastsController : ControllerBase
{
    private readonly IMediator _mediator;

    public ForecastsController(IMediator mediator) => _mediator = mediator;

    /// <summary>
    /// Dự báo nhu cầu tồn kho cho SKU sản phẩm
    /// </summary>
    [HttpGet("demand-prediction")]
    public async Task<IActionResult> GetDemandPrediction([FromQuery] string sku)
        => (await _mediator.Send(new GetStockForecastQuery(new StockForecastRequest { Sku = sku }))).ToActionResult();
}