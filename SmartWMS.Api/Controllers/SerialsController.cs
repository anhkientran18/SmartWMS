using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartWMS.Application.Features.OutboundOrders.Commands.PickWithSerial;
using System.Threading.Tasks;

namespace SmartWMS.Api.Controllers;

[Authorize(Roles = "Admin,Manager,Staff")]
[ApiController]
[Route("api/v1/[controller]")]
public class SerialsController : ControllerBase
{
    private readonly IMediator _mediator;

    public SerialsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpPost("pick-verify")]
    public async Task<IActionResult> PickVerifySerial([FromBody] PickWithSerialCommand command)
    {
        var result = await _mediator.Send(command);
        if (result.IsSuccess) return Ok(result);
        return BadRequest(result);
    }
}