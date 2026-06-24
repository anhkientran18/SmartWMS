using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartWMS.Application.Features.OutboundIssues.Commands.Create;
using SmartWMS.Application.Features.OutboundIssues.Queries;

namespace SmartWMS.Api.Controllers;

[Authorize(Roles = "Admin,Manager")]
[ApiController]
[Route("api/v1/[controller]")]
public class OutboundIssuesController : ControllerBase
{
    private readonly IMediator _mediator;

    public OutboundIssuesController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpPost]
    public async Task<IActionResult> CreateOutboundIssue([FromBody] CreateOutboundIssueCommand command)
    {
        var result = await _mediator.Send(command);

        if (result.IsSuccess)
        {
            return Ok(result);
        }

        return BadRequest(result);
    }

    // BỔ SUNG QUAN TRỌNG: Endpoint gom đơn hàng loạt và tối ưu lộ trình di chuyển (Wave Picking)
    [HttpPost("wave-picking")]
    public async Task<IActionResult> CreateWavePickingRoute([FromBody] List<Guid> orderIds)
    {
        var query = new GetOptimizedWavePickingQuery { OrderIds = orderIds };
        var result = await _mediator.Send(query);

        if (result.IsSuccess)
        {
            return Ok(result);
        }

        return BadRequest(result);
    }
    /// API xử lý phê duyệt cách ly và đóng băng nghiêm ngặt lượng hàng hóa bị hư hỏng, lỗi cấu trúc
    [HttpPost("process-quarantine")]
    public async Task<IActionResult> ProcessDamageQuarantine([FromBody] SmartWMS.Application.Features.InventoryManagement.Commands.ProcessDamageQuarantine.ProcessDamageQuarantineCommand command)
    {
        var result = await _mediator.Send(command);
        if (result.IsSuccess)
        {
            return Ok(result);
        }
        return BadRequest(result);
    }
}