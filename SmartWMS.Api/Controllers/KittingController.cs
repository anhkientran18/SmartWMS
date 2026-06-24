using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartWMS.Application.Features.Kitting.Commands.AssembleKit;
using System.Threading.Tasks;

namespace SmartWMS.Api.Controllers;

[Authorize(Roles = "Admin,Manager")]
[ApiController]
[Route("api/v1/[controller]")]
public class KittingController : ControllerBase
{
    private readonly IMediator _mediator;

    public KittingController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpPost("assemble")]
    public async Task<IActionResult> AssembleKit([FromBody] AssembleKitCommand command)
    {
        var result = await _mediator.Send(command);
        if (result.IsSuccess) return Ok(result);
        return BadRequest(result);
    }
}