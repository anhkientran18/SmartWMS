using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartWMS.Application.Features.Chat.Queries;

namespace SmartWMS.Api.Controllers;

[Authorize] // Chỉ người dùng đã đăng nhập hệ thống mới được sử dụng Trợ lý ảo
[ApiController]
[Route("api/v1/[controller]")]
public class ChatController : ControllerBase
{
    private readonly IMediator _mediator;

    public ChatController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpPost("ask")]
    public async Task<IActionResult> AskAssistant([FromBody] ChatRequest request)
    {
        var result = await _mediator.Send(new GetAiChatResponseQuery(request.Message));

        if (result.IsSuccess)
            return Ok(result);

        return BadRequest(result);
    }
}

public class ChatRequest
{
    public string Message { get; set; } = string.Empty;
}