using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartWMS.Application.Features.Dashboard.Queries.GetDashboardInsightQuery;
using SmartWMS.Application.Features.Dashboard.Queries.GetWarehouseDashboard;

namespace SmartWMS.Api.Controllers;

[Authorize(Roles = "Admin,Manager")]
[ApiController]
[Route("api/v1/[controller]")]
public class DashboardController : ControllerBase
{
    private readonly IMediator _mediator;

    public DashboardController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet("insight")]
    public async Task<IActionResult> GetInsight()
    {
        var result = await _mediator.Send(new GetDashboardInsightQuery());
        if (result.IsSuccess) return Ok(result);
        return BadRequest(result);
    }
    /// API truy vấn toàn bộ chỉ số KPI cốt lõi phục vụ biểu diễn biểu đồ Frontend
    [HttpGet("metrics")]
    public async Task<IActionResult> GetDashboardMetrics()
    {
        var result = await _mediator.Send(new GetWarehouseDashboardQuery());

        if (result.IsSuccess)
        {
            return Ok(result);
        }

        return BadRequest(result);
    }
    /// API kích hoạt trí tuệ nhân tạo AI tự động càn quét lịch sử giao dịch để đề xuất sắp xếp lại vị trí ô kệ tối ưu (Slotting)
    [HttpGet("ai-slotting-recommendations")]
    public async Task<IActionResult> GetAiSlottingRecommendations()
    {
        var result = await _mediator.Send(new SmartWMS.Application.Features.InventoryManagement.Queries.GetSlottingRecommendations.GetSlottingRecommendationsQuery());

        if (result.IsSuccess)
        {
            return Ok(result);
        }

        return BadRequest(result);
    }
}