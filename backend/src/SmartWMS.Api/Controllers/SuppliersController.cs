using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartWMS.Application.Features.Suppliers.Commands.CreateSupplier;
using SmartWMS.Application.Features.Suppliers.Commands.DeleteSupplier;
using SmartWMS.Application.Features.Suppliers.Commands.UpdateSupplier;
using SmartWMS.Application.Features.Suppliers.DTOs.Commands;
using SmartWMS.Application.Features.Suppliers.Queries.GetPaginatedSuppliers;
using SmartWMS.Application.Features.Suppliers.Queries.GetSupplierById;
using SmartWMS.Application.Features.Suppliers.Queries.GetSupplierList;
using SmartWMS.Api.Extensions;
using System;
using System.Threading.Tasks;

namespace SmartWMS.Api.Controllers;

[Authorize(Roles = "Admin, WarehouseManager")]
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public class SuppliersController : ControllerBase
{
    private readonly IMediator _mediator;
    public SuppliersController(IMediator mediator) => _mediator = mediator;

    [HttpGet("list")]
    public async Task<IActionResult> GetList()
        => (await _mediator.Send(new GetSupplierListQuery())).ToActionResult();

    [HttpGet]
    public async Task<IActionResult> GetPaginated([FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 10, [FromQuery] string? searchTerm = null)
        => (await _mediator.Send(new GetPaginatedSuppliersQuery(pageNumber, pageSize, searchTerm))).ToActionResult();

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
        => (await _mediator.Send(new GetSupplierByIdQuery(id))).ToActionResult();

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateSupplierRequest request)
        => (await _mediator.Send(new CreateSupplierCommand(request))).ToActionResult();

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateSupplierRequest request)
    {
        if (id != request.Id)
            return BadRequest(new { isSuccess = false, message = "Mã ID đường dẫn không trùng khớp với dữ liệu." });

        return (await _mediator.Send(new UpdateSupplierCommand(request))).ToActionResult();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
        => (await _mediator.Send(new DeleteSupplierCommand(new DeleteSupplierRequest { Id = id }))).ToActionResult();
}