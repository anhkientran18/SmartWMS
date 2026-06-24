using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartWMS.Application.Features.InventoryTransfers.Commands.Create;

namespace SmartWMS.Api.Controllers;

[Authorize(Roles = "Admin,Manager,Staff")] // Nhân viên kho cũng được quyền thực hiện luân chuyển
[ApiController]
[Route("api/v1/[controller]")]
public class InventoryTransfersController : ControllerBase
{
    private readonly IMediator _mediator;

    public InventoryTransfersController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpPost]
    public async Task<IActionResult> Transfer([FromBody] CreateInventoryTransferCommand command)
    {
        var result = await _mediator.Send(command);

        if (result.IsSuccess)
        {
            return Ok(result);
        }

        return BadRequest(result);
    }
    /// API thực thi lệnh điều chuyển hàng hóa giữa các ô kệ nội bộ, bọc cấu hình chống tranh chấp concurrency
    [HttpPost("move-bin-to-bin")]
    public async Task<IActionResult> MoveInventory([FromBody] SmartWMS.Application.Features.InventoryManagement.Commands.MoveInventory.MoveInventoryCommand command)
    {
        var result = await _mediator.Send(command);
        if (result.IsSuccess) return Ok(result);
        return BadRequest(result);
    }
}