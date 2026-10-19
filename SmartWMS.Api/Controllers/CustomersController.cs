using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartWMS.Application.Features.Customers.Commands.CreateCustomer;
using SmartWMS.Application.Features.Customers.Commands.DeleteCustomer;
using SmartWMS.Application.Features.Customers.Commands.UpdateCustomer;
using SmartWMS.Application.Features.Customers.DTOs.Commands;
using SmartWMS.Application.Features.Customers.Queries.GetCustomerById;
using SmartWMS.Application.Features.Customers.Queries.GetPaginatedCustomers;
using SmartWMS.Application.Features.Customers.Queries.GetCustomerList;
using SmartWMS.Api.Extensions;
using System;
using System.Threading.Tasks;

namespace SmartWMS.Api.Controllers;

[Authorize(Roles = "Admin, WarehouseManager, Staff")]
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public class CustomersController : ControllerBase
{
    private readonly IMediator _mediator;
    public CustomersController(IMediator mediator) => _mediator = mediator;

    [HttpGet("list")]
    public async Task<IActionResult> GetList()
        => (await _mediator.Send(new GetCustomerListQuery())).ToActionResult();

    [HttpGet]
    public async Task<IActionResult> GetPaginated([FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 10, [FromQuery] string? searchTerm = null)
        => (await _mediator.Send(new GetPaginatedCustomersQuery(pageNumber, pageSize, searchTerm))).ToActionResult();

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
        => (await _mediator.Send(new GetCustomerByIdQuery(id))).ToActionResult();

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateCustomerRequest request)
        => (await _mediator.Send(new CreateCustomerCommand(request))).ToActionResult();

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateCustomerRequest request)
    {
        if (id != request.Id)
            return BadRequest(new { isSuccess = false, message = "Mã ID đường dẫn không trùng khớp với dữ liệu." });

        return (await _mediator.Send(new UpdateCustomerCommand(request))).ToActionResult();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
        => (await _mediator.Send(new DeleteCustomerCommand(new DeleteCustomerRequest { Id = id }))).ToActionResult();
}