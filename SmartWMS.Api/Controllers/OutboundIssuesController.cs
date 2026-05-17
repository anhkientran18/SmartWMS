using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartWMS.Application.Features.OutboundIssues.Commands;

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
}