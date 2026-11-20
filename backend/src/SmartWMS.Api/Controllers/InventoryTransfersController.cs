using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartWMS.Api.Extensions;
using SmartWMS.Application.Features.InventoryTransfers.Commands.CreateInventoryTransfer;
using SmartWMS.Application.Features.InventoryTransfers.DTOs.Commands;
using SmartWMS.Application.Features.InventoryTransfers.DTOs.Queries;
using SmartWMS.Application.Features.InventoryTransfers.Queries.GetById;
using SmartWMS.Application.Features.InventoryTransfers.Queries.GetList;
using SmartWMS.Application.Features.InventoryTransfers.Queries.GetPaginatedInventoryTransfers;
using System;
using System.Threading.Tasks;

namespace SmartWMS.Api.Controllers;

[Authorize(Roles = "Admin,WarehouseManager,Staff")]
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public class InventoryTransfersController : ControllerBase
{
    private readonly IMediator _mediator;

    public InventoryTransfersController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    public async Task<IActionResult> GetPaginated(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] Guid? productId = null,
        [FromQuery] string? searchKeyword = null)
        => (await _mediator.Send(new GetPaginatedInventoryTransfersQuery(new InventoryTransferPaginatedQueryRequest
        {
            PageIndex = pageNumber,
            PageSize = pageSize,
            ProductId = productId,
            SearchKeyword = searchKeyword
        }))).ToActionResult();

    [HttpGet("list")]
    public async Task<IActionResult> GetList([FromQuery] Guid? productId = null, [FromQuery] string? searchKeyword = null)
        => (await _mediator.Send(new GetInventoryTransferListQuery(new InventoryTransferListQueryRequest
        {
            ProductId = productId,
            SearchKeyword = searchKeyword
        }))).ToActionResult();

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
        => (await _mediator.Send(new GetInventoryTransferByIdQuery(new InventoryTransferByIdRequest { Id = id }))).ToActionResult();

    [HttpPost]
    public async Task<IActionResult> Transfer([FromBody] CreateInventoryTransferRequest request)
        => (await _mediator.Send(new CreateInventoryTransferCommand(request))).ToActionResult();
}