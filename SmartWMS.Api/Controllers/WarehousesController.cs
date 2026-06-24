using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Warehouses.Commands;
using SmartWMS.Application.Features.Warehouses.Commands.CreateWarehouse;
using SmartWMS.Application.Features.Warehouses.Queries;
using SmartWMS.Application.Features.Warehouses.Queries.GetPaginatedWarehouses;

namespace SmartWMS.Api.Controllers;

[Authorize(Roles = "Admin,Manager")] // Bảo mật: Chỉ Admin và Manager mới có quyền thêm/sửa/xóa kho
[ApiController]
[Route("api/v1/[controller]")]
public class WarehousesController : ControllerBase
{
    private readonly IMediator _mediator;

    public WarehousesController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var result = await _mediator.Send(new GetAllWarehousesQuery());
        if (result.IsSuccess) return Ok(result);
        return BadRequest(result);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _mediator.Send(new GetWarehouseByIdQuery(id));
        if (result.IsSuccess) return Ok(result);
        return NotFound(result);
    }

    [HttpGet("pagination")]
    public async Task<IActionResult> GetPaginated([FromQuery] GetPaginatedWarehousesQuery query)
    {
        // 1. Sử dụng _mediator (có gạch dưới)
        var result = await _mediator.Send(query);

        // 2. Kiểm tra IsSuccess để đồng bộ với các API khác
        if (result.IsSuccess)
            return Ok(result);

        return BadRequest(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateWarehouseCommand command)
    {
        var result = await _mediator.Send(command);
        if (result.IsSuccess) return Ok(result);
        return BadRequest(result);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateWarehouseCommand command)
    {
        if (id != command.Id)
            return BadRequest(new { isSuccess = false, message = "ID không trùng khớp." });

        var result = await _mediator.Send(command);
        if (result.IsSuccess) return Ok(result);
        return BadRequest(result);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _mediator.Send(new DeleteWarehouseCommand(id));
        if (result.IsSuccess) return Ok(result);
        return BadRequest(result); // Trả về BadRequest để hiển thị lỗi do vi phạm ràng buộc (vd: Kho đang có Zone)
    }
}