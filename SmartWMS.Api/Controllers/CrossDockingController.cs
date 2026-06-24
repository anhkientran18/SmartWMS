using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartWMS.Application.Features.CrossDocking.Commands.ProcessCrossDock;
using System.Threading.Tasks;

namespace SmartWMS.Api.Controllers;

[Authorize(Roles = "Admin,Manager,Staff")] // Phân quyền: Nhân viên vận hành hiện trường và quản lý đều có thể kích hoạt
[ApiController]
[Route("api/v1/[controller]")] // Đường dẫn API trực quan: api/v1/cross-docking
public class CrossDockingController : ControllerBase
{
    private readonly IMediator _mediator;

    public CrossDockingController(IMediator mediator)
    {
        _mediator = mediator;
    }

    /// API tiếp nhận hàng hạ tải tại cửa kho, tự động đánh chặn và kích hoạt luồng xuất thẳng không qua lưu kệ
    [HttpPost("process")] // Định tuyến thực tế: api/v1/cross-docking/process
    public async Task<IActionResult> ProcessCrossDock([FromBody] ProcessCrossDockCommand command)
    {
        var result = await _mediator.Send(command);

        if (result.IsSuccess)
        {
            return Ok(result);
        }

        return BadRequest(result);
    }
}