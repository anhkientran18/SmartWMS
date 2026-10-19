using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartWMS.Api.Extensions;
using SmartWMS.Application.Features.Kitting.Commands.AssembleKit;
using SmartWMS.Application.Features.Kitting.DTOs.Commands;
using System.Threading.Tasks;

namespace SmartWMS.Api.Controllers;

[Authorize(Roles = "Admin,WarehouseManager")]
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public class KittingController : ControllerBase
{
    private readonly IMediator _mediator;
    public KittingController(IMediator mediator) => _mediator = mediator;

    [HttpPost("assemble")]
    public async Task<IActionResult> AssembleKit([FromBody] AssembleKitRequest request)
        => (await _mediator.Send(new AssembleKitCommand(request))).ToActionResult();
}