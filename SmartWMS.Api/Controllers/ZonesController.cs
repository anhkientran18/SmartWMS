using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartWMS.Api.Extensions;
using SmartWMS.Application.Features.Zones.Commands.CreateZone;
using SmartWMS.Application.Features.Zones.Commands.DeleteZone;
using SmartWMS.Application.Features.Zones.Commands.UpdateZone;
using SmartWMS.Application.Features.Zones.DTOs.Commands;
using SmartWMS.Application.Features.Zones.DTOs.Queries;
using SmartWMS.Application.Features.Zones.Queries.GetList;
using SmartWMS.Application.Features.Zones.Queries.GetPaginatedZones;
using SmartWMS.Application.Features.Zones.Queries.GetZonesByWarehouseId;
using System;
using System.Threading.Tasks;

namespace SmartWMS.Api.Controllers;

[Authorize(Roles = "Admin,WarehouseManager")]
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public class ZonesController : ControllerBase
{
    private readonly IMediator _mediator;
    public ZonesController(IMediator mediator) => _mediator = mediator;

    [HttpGet("list")]
    public async Task<IActionResult> GetList([FromQuery] string? searchKeyword = null)
        => (await _mediator.Send(new GetZoneListQuery(new ZoneListQueryRequest { SearchKeyword = searchKeyword }))).ToActionResult();

    [HttpGet("warehouse/{warehouseId:guid}")]
    public async Task<IActionResult> GetByWarehouse(Guid warehouseId)
        => (await _mediator.Send(new GetZonesByWarehouseIdQuery(new ZoneByWarehouseIdQueryRequest { WarehouseId = warehouseId }))).ToActionResult();

    [HttpGet]
    public async Task<IActionResult> GetPaginated([FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 10, [FromQuery] string? searchKeyword = null)
        => (await _mediator.Send(new GetPaginatedZonesQuery(new ZonePaginatedListQueryRequest { PageIndex = pageNumber, PageSize = pageSize, SearchKeyword = searchKeyword }))).ToActionResult();

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateZoneRequest request)
        => (await _mediator.Send(new CreateZoneCommand(request))).ToActionResult();

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateZoneRequest request)
    {
        if (id != request.Id) return BadRequest(new { isSuccess = false, message = "ID không trùng khớp." });
        return (await _mediator.Send(new UpdateZoneCommand(request))).ToActionResult();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
        => (await _mediator.Send(new DeleteZoneCommand(new DeleteZoneRequest { Id = id }))).ToActionResult();
}