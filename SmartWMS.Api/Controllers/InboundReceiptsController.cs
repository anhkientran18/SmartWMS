using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartWMS.Application.Features.InboundReceipts.Commands;

namespace SmartWMS.Api.Controllers;

[Authorize(Roles = "Admin,Manager,Staff")]
[ApiController]
[Route("api/v1/[controller]")] // Định tuyến API có version
public class InboundReceiptsController : ControllerBase
{
    private readonly IMediator _mediator;

    public InboundReceiptsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpPost]
    public async Task<IActionResult> CreateInboundReceipt([FromBody] CreateInboundReceiptCommand command)
    {
        // Gửi Command vào MediatR Pipeline, nó sẽ tự tìm đến CreateInboundReceiptCommandHandler
        var result = await _mediator.Send(command);

        if (result.IsSuccess)
        {
            // Trả về mã 200 OK cùng dữ liệu (Id của Bin và thông báo thành công đa ngôn ngữ)
            return Ok(result);
        }

        // Nếu thất bại (SKU không tồn tại, quá sức chứa...), trả về 400 Bad Request
        return BadRequest(result);
    }
}