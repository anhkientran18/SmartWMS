using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartWMS.Application.Features.OutboundOrders.Commands.ValidatePackingWeight;
using System.Threading.Tasks;

namespace SmartWMS.Api.Controllers;

[Authorize(Roles = "Admin,Manager,Staff")]
[ApiController]
[Route("api/v1/[controller]")]
public class OutboundOrdersController : ControllerBase
{
    private readonly IMediator _mediator;

    public OutboundOrdersController(IMediator mediator)
    {
        _mediator = mediator;
    }

    // API Endpoint xác thực trọng lượng đóng gói chống thất thoát tại trạm Packing
    [HttpPost("validate-weight")]
    public async Task<IActionResult> ValidatePackingWeight([FromBody] ValidatePackingWeightCommand command)
    {
        var result = await _mediator.Send(command);

        if (result.IsSuccess)
        {
            // Trả về kết quả phân tích sai số
            return Ok(result);
        }

        return BadRequest(result);
    }
    // API Kích hoạt bộ máy phân bổ hàng xuất kho tự động và lập chỉ thị bốc hàng
    [HttpPost("allocate-pick-task")]
    public async Task<IActionResult> AllocatePickTask([FromBody] SmartWMS.Application.Features.OutboundOrders.Commands.CreatePickTask.CreatePickTaskCommand command)
    {
        var result = await _mediator.Send(command);

        if (result.IsSuccess)
        {
            return Ok(result);
        }

        return BadRequest(result);
    }
    /// API Kích hoạt bộ máy gom đơn hàng loạt và lập lệnh nhặt hàng theo sóng (Wave Picking Engine)
    [HttpPost("create-wave-pick")]
    public async Task<IActionResult> CreateWavePick([FromBody] SmartWMS.Application.Features.OutboundOrders.Commands.CreateWavePickTask.CreateWavePickTaskCommand command)
    {
        var result = await _mediator.Send(command);

        if (result.IsSuccess)
        {
            return Ok(result);
        }

        return BadRequest(result);
    }
}