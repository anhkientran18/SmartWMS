using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartWMS.Api.Extensions;
using SmartWMS.Application.Features.OutboundOrders.Commands.CreateOutboundOrder;
using SmartWMS.Application.Features.OutboundOrders.Commands.CreatePickTask;
using SmartWMS.Application.Features.OutboundOrders.Commands.CreateWavePickTask;
using SmartWMS.Application.Features.OutboundOrders.Commands.DeleteOutboundOrder;
using SmartWMS.Application.Features.OutboundOrders.Commands.PickWithSerial;
using SmartWMS.Application.Features.OutboundOrders.Commands.ShipOutboundOrder;
using SmartWMS.Application.Features.OutboundOrders.Commands.UpdateOutboundOrder;
using SmartWMS.Application.Features.OutboundOrders.Commands.DirectPick;
using SmartWMS.Application.Features.OutboundOrders.Commands.ValidatePackingWeight;
using SmartWMS.Application.Features.OutboundOrders.DTOs.Commands;
using SmartWMS.Application.Features.OutboundOrders.DTOs.Queries;
using SmartWMS.Application.Features.OutboundOrders.Queries.GetList;
using SmartWMS.Application.Features.OutboundOrders.Queries.GetOutboundOrderById;
using SmartWMS.Application.Features.OutboundOrders.Queries.GetPaginatedOutboundOrders;
using System;
using System.Threading.Tasks;

namespace SmartWMS.Api.Controllers;

[Authorize(Roles = "Admin,WarehouseManager,Staff")]
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public class OutboundOrdersController : ControllerBase
{
    private readonly IMediator _mediator;
    public OutboundOrdersController(IMediator mediator) => _mediator = mediator;

    [HttpGet("list")]
    public async Task<IActionResult> GetList([FromQuery] Guid? customerId = null, [FromQuery] string? status = null, [FromQuery] string? searchKeyword = null)
        => (await _mediator.Send(new GetOutboundOrderListQuery(new OutboundOrderListQueryRequest
        {
            CustomerId = customerId,
            Status = status,
            SearchKeyword = searchKeyword
        }))).ToActionResult();

    [HttpGet]
    public async Task<IActionResult> GetPaginated([FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 10, [FromQuery] string? searchTerm = null, [FromQuery] Guid? customerId = null)
        => (await _mediator.Send(new GetPaginatedOutboundOrdersQuery(new OutboundOrderPaginatedQueryRequest { PageIndex = pageNumber, PageSize = pageSize, SearchKeyword = searchTerm, CustomerId = customerId }))).ToActionResult();

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
        => (await _mediator.Send(new GetOutboundOrderByIdQuery(new OutboundOrderByIdQueryRequest { Id = id }))).ToActionResult();

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateOutboundOrderRequest request)
        => (await _mediator.Send(new CreateOutboundOrderCommand(request))).ToActionResult();

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateOutboundOrderRequest request)
    {
        if (id != request.Id)
            return BadRequest(new { isSuccess = false, message = "Mã ID đường dẫn không khớp với dữ liệu." });

        return (await _mediator.Send(new UpdateOutboundOrderCommand(request))).ToActionResult();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
        => (await _mediator.Send(new DeleteOutboundOrderCommand(new DeleteOutboundOrderRequest { Id = id }))).ToActionResult();

    [HttpPost("allocate-pick-task")]
    public async Task<IActionResult> AllocatePickTask([FromBody] CreatePickTaskRequest request)
        => (await _mediator.Send(new CreatePickTaskCommand(request))).ToActionResult();

    [HttpPost("create-wave-pick")]
    public async Task<IActionResult> CreateWavePick([FromBody] CreateWavePickRequest request)
        => (await _mediator.Send(new CreateWavePickTaskCommand(request))).ToActionResult();

    [HttpPost("pick-verify")]
    public async Task<IActionResult> PickVerifySerial([FromBody] PickWithSerialRequest request)
        => (await _mediator.Send(new PickWithSerialCommand(request))).ToActionResult();

    [HttpPost("{id:guid}/pick")]
    public async Task<IActionResult> Pick(Guid id, [FromBody] DirectPickRequest request, CancellationToken ct)
        => (await _mediator.Send(new DirectPickCommand(id, request), ct)).ToActionResult();

    [HttpPost("{id:guid}/pack")]
    public async Task<IActionResult> Pack(Guid id, CancellationToken ct)
        => (await _mediator.Send(new PackOutboundOrderCommand(id), ct)).ToActionResult();

    [HttpPost("{id:guid}/ship")]
    public async Task<IActionResult> Ship(Guid id, [FromBody] ShipOutboundOrderRequest request, CancellationToken cancellationToken)
        => (await _mediator.Send(new ShipOutboundOrderCommand(id, request), cancellationToken)).ToActionResult();

    [HttpPost("validate-weight")]
    public async Task<IActionResult> ValidatePackingWeight([FromBody] ValidatePackingWeightRequest request)
        => (await _mediator.Send(new ValidatePackingWeightCommand(request))).ToActionResult();
}
