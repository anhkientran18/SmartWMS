using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartWMS.Api.Extensions;
using SmartWMS.Application.Features.Chat.DTOs.Queries;
using SmartWMS.Application.Features.Chat.Queries.GetAiChatResponse;
using System.Threading.Tasks;

namespace SmartWMS.Api.Controllers;

[Authorize]
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public class ChatController : ControllerBase
{
    private readonly IMediator _mediator;
    public ChatController(IMediator mediator) => _mediator = mediator;

    [HttpPost("ask")]
    public async Task<IActionResult> AskGemini([FromBody] AiChatRequest request, CancellationToken ct)
        => (await _mediator.Send(new GetAiChatResponseQuery(request), ct)).ToActionResult();
}