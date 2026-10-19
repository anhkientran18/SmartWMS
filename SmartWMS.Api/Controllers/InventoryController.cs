using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartWMS.Api.Extensions;
using SmartWMS.Application.Features.InventoryManagement.Commands.AdjustStock;
using SmartWMS.Application.Features.InventoryManagement.Commands.AutoReplenish;
using SmartWMS.Application.Features.InventoryManagement.Commands.ChangeStockStatus;
using SmartWMS.Application.Features.InventoryManagement.DTOs.Commands;
using SmartWMS.Application.Features.InventoryManagement.DTOs.Queries;
using SmartWMS.Application.Features.InventoryManagement.Queries.GetInventorySummary;
using SmartWMS.Application.Features.InventoryManagement.Queries.GetLowStockAlerts;
using SmartWMS.Application.Features.InventoryManagement.Queries.GetStockHistory;

namespace SmartWMS.Api.Controllers.V1;

[Authorize]
[ApiController]
[Route("api/v1/[controller]")]
public class InventoryController : ControllerBase
{
    private readonly IMediator _mediator;

    public InventoryController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet("stock-summary")]
    public async Task<IActionResult> GetStockSummary()
        => (await _mediator.Send(new GetInventorySummaryQuery())).ToActionResult();

    [HttpGet("low-stock-alerts")]
    public async Task<IActionResult> GetLowStockAlerts([FromQuery] GetLowStockAlertsQuery query)
        => (await _mediator.Send(query)).ToActionResult();

    [HttpPost("adjust-stock")]
    public async Task<IActionResult> AdjustStock([FromBody] AdjustStockRequest request)
        => (await _mediator.Send(new AdjustStockCommand(request))).ToActionResult();

    [HttpGet("stock-history")]
    public async Task<IActionResult> GetStockHistory([FromQuery] StockHistoryPaginatedRequest request)
        => (await _mediator.Send(new GetStockHistoryQuery(request))).ToActionResult();

    [HttpPost("change-status")]
    public async Task<IActionResult> ChangeStockStatus([FromBody] ChangeStockStatusRequest request)
        => (await _mediator.Send(new ChangeStockStatusCommand(request))).ToActionResult();

    [HttpPost("run-auto-replenish")]
    public async Task<IActionResult> RunAutoReplenish()
        => (await _mediator.Send(new AutoReplenishCommand())).ToActionResult();
}
