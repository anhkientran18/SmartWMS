using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartWMS.Api.Extensions;
using SmartWMS.Application.Features.Warehouses.Commands.CreateWarehouse;
using SmartWMS.Application.Features.Warehouses.Commands.DeleteWarehouse;
using SmartWMS.Application.Features.Warehouses.Commands.UpdateWarehouse;
using SmartWMS.Application.Features.Warehouses.DTOs.Commands;
using SmartWMS.Application.Features.Warehouses.DTOs.Queries;
using SmartWMS.Application.Features.Warehouses.Queries.GetList;
using SmartWMS.Application.Features.Warehouses.Queries.GetPaginatedWarehouses;
using SmartWMS.Application.Features.Warehouses.Queries.GetWarehouseById;
using System;
using System.Threading.Tasks;

namespace SmartWMS.Api.Controllers;

[Authorize(Roles = "Admin,WarehouseManager")]
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public class WarehousesController : ControllerBase
{
    private readonly IMediator _mediator;
    public WarehousesController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<IActionResult> GetPaginated([FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 10, [FromQuery] string? searchKeyword = null)
        => (await _mediator.Send(new GetPaginatedWarehousesQuery(new WarehousePaginatedListQueryRequest { PageIndex = pageNumber, PageSize = pageSize, SearchKeyword = searchKeyword }))).ToActionResult();

    [HttpGet("list")]
    public async Task<IActionResult> GetList([FromQuery] string? searchKeyword = null)
        => (await _mediator.Send(new GetWarehouseListQuery(new WarehouseListQueryRequest { SearchKeyword = searchKeyword }))).ToActionResult();

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
        => (await _mediator.Send(new GetWarehouseByIdQuery(new WarehouseByIdQueryRequest { Id = id }))).ToActionResult();

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateWarehouseRequest request)
        => (await _mediator.Send(new CreateWarehouseCommand(request))).ToActionResult();

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateWarehouseRequest request)
    {
        if (id != request.Id) return BadRequest(new { isSuccess = false, message = "ID không trùng khớp." });
        return (await _mediator.Send(new UpdateWarehouseCommand(request))).ToActionResult();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
        => (await _mediator.Send(new DeleteWarehouseCommand(new DeleteWarehouseRequest { Id = id }))).ToActionResult();
}