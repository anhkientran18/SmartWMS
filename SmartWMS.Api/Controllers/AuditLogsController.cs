using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartWMS.Application.Features.AuditLogs.Queries;

namespace SmartWMS.Api.Controllers;

[Authorize(Roles = "Admin")] // BẢO MẬT: Chỉ có Giám đốc hệ thống (Admin) mới được xem lịch sử thao tác
[ApiController]
[Route("api/v1/[controller]")]
public class AuditLogsController : ControllerBase
{
    private readonly IMediator _mediator;

    public AuditLogsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    public async Task<IActionResult> GetLogs([FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 20)
    {
        var result = await _mediator.Send(new GetAuditLogsQuery(pageNumber, pageSize));

        if (result.IsSuccess)
        {
            return Ok(result);
        }

        return BadRequest(result);
    }
}