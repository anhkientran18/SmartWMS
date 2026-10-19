using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartWMS.Api.Extensions;
using SmartWMS.Application.Features.Dashboard.Queries.GetAIAgentMetrics;
using SmartWMS.Application.Features.Dashboard.Queries.GetExecutiveDashboard;
using SmartWMS.Application.Features.Dashboard.Queries.GetInboundOutboundChart;
using SmartWMS.Application.Features.Dashboard.Queries.GetWarehouseOccupancy;
using SmartWMS.Application.Features.InventoryManagement.DTOs.Queries;
using SmartWMS.Application.Features.InventoryManagement.Queries.GetSlottingRecommendations;

namespace SmartWMS.Api.Controllers; // Giữ nguyên namespace gốc

[Authorize]
[Route("api/v1/[controller]")]
[ApiController]
public class DashboardController : ControllerBase
{
    private readonly IMediator _mediator;

    public DashboardController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet("executive")]
    public async Task<IActionResult> GetExecutiveDashboard()
        => (await _mediator.Send(new GetExecutiveDashboardQuery())).ToActionResult();

    [HttpGet("inbound-outbound-chart")]
    public async Task<IActionResult> GetInboundOutboundChart([FromQuery] int days = 7)
        => (await _mediator.Send(new GetInboundOutboundChartQuery { Days = days })).ToActionResult();

    [HttpGet("warehouse-occupancy")]
    public async Task<IActionResult> GetWarehouseOccupancy()
        => (await _mediator.Send(new GetWarehouseOccupancyQuery())).ToActionResult();

    [HttpGet("ai-agent-metrics")]
    public async Task<IActionResult> GetAIAgentMetrics()
        => (await _mediator.Send(new GetAIAgentMetricsQuery())).ToActionResult();

    [HttpGet("ai-slotting-recommendations")]
    public async Task<IActionResult> GetAiSlottingRecommendations([FromQuery] Guid? zoneId = null)
    {
        var requestData = new SlottingRecommendationRequest
        {
            ZoneId = zoneId
        };
        return (await _mediator.Send(new GetSlottingRecommendationsQuery(requestData))).ToActionResult();
    }
}
