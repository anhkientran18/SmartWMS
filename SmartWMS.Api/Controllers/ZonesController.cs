using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartWMS.Application.Features.Zones.Commands;
using SmartWMS.Application.Features.Zones.Queries;
using SmartWMS.Application.Features.Zones.Queries.GetAllZones;
using SmartWMS.Application.Features.Zones.Queries.GetPaginatedZones;

namespace SmartWMS.Api.Controllers;

[Authorize(Roles = "Admin,Manager")] // Bảo mật chỉ quản lý mới được xem và sửa sơ đồ Zone
[ApiController]
[Route("api/v1/[controller]")]
public class ZonesController : ControllerBase
{
    private readonly IMediator _mediator;
    public ZonesController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var result = await _mediator.Send(new GetAllZonesQuery());
        if (result.IsSuccess) return Ok(result);
        return BadRequest(result);
    }

    [HttpGet("warehouse/{warehouseId}")]
    public async Task<IActionResult> GetByWarehouse(Guid warehouseId)
    {
        var result = await _mediator.Send(new GetZonesByWarehouseIdQuery(warehouseId));
        if (result.IsSuccess) return Ok(result);
        return BadRequest(result);
    }

    [HttpGet("pagination")]
    public async Task<IActionResult> GetPaginated([FromQuery] GetPaginatedZonesQuery query)
    {
        var result = await _mediator.Send(query);
        if (result.IsSuccess) return Ok(result);
        return BadRequest(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateZoneCommand command)
    {
        var result = await _mediator.Send(command);
        if (result.IsSuccess) return Ok(result);
        return BadRequest(result);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateZoneCommand command)
    {
        if (id != command.Id) return BadRequest(new { isSuccess = false, message = "ID không trùng khớp." });

        var result = await _mediator.Send(command);
        if (result.IsSuccess) return Ok(result);
        return BadRequest(result);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _mediator.Send(new DeleteZoneCommand(id));
        if (result.IsSuccess) return Ok(result);
        return BadRequest(result);
    }
}