using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartWMS.Application.Features.CycleCounting.Queries.GetPendingCountTasks;
using SmartWMS.Application.Features.InventoryManagement.Commands.CreateCountSheet;
using System.Threading.Tasks;

namespace SmartWMS.Api.Controllers;

[Authorize(Roles = "Admin,Manager,Staff")]
[ApiController]
[Route("api/v1/[controller]")]
public class CycleCountingController : ControllerBase
{
    private readonly IMediator _mediator;

    public CycleCountingController(IMediator mediator)
    {
        _mediator = mediator;
    }

    // API Endpoint lấy danh sách các mặt hàng đến hạn phải đi kiểm kê cuốn chiếu
    [HttpGet("pending-tasks")]
    public async Task<IActionResult> GetPendingTasks([FromQuery] string operatorName)
    {
        var query = new GetPendingCountTasksQuery { OperatorName = operatorName ?? "WarehouseStaff" };
        var result = await _mediator.Send(query);

        if (result.IsSuccess)
        {
            return Ok(result);
        }

        return BadRequest(result);
    }
    /// API kích hoạt lập chỉ thị kiểm kho hiện trường
    [HttpPost("create-sheet")]
    public async Task<IActionResult> CreateCountSheet([FromBody] CreateCountSheetCommand command)
    {
        var result = await _mediator.Send(command);

        if (result.IsSuccess)
        {
            return Ok(result);
        }

        return BadRequest(result);
    }
    /// API Kích hoạt bộ máy AI tự động phân tích rủi ro biến động giao dịch và lập lịch kiểm kê cuốn chiếu
    [HttpPost("trigger-auto-schedule")]
    public async Task<IActionResult> TriggerAutoCycleCount([FromBody] SmartWMS.Application.Features.InventoryManagement.Commands.ScheduleAutoCycleCount.ScheduleAutoCycleCountCommand command)
    {
        var result = await _mediator.Send(command);

        if (result.IsSuccess)
        {
            return Ok(result);
        }

        return BadRequest(result);
    }
    /// API Đối chiếu và phê duyệt số liệu kiểm kê cuốn chiếu thực tế từ hiện trường, tự động xử lý lệch Sổ cái
    [HttpPost("confirm-result")]
    public async Task<IActionResult> ConfirmCycleCount([FromBody] SmartWMS.Application.Features.InventoryManagement.Commands.ConfirmCycleCount.ConfirmCycleCountCommand command)
    {
        var result = await _mediator.Send(command);
        if (result.IsSuccess) return Ok(result);
        return BadRequest(result);
    }
}