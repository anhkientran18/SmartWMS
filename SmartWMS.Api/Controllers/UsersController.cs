using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartWMS.Api.Extensions;
using SmartWMS.Application.Features.Users.Commands;
using SmartWMS.Application.Features.Users.DTOs;
using SmartWMS.Application.Features.Users.Queries;
using SmartWMS.Application.Features.Users.Queries.GetUserList;
using System;
using System.Threading.Tasks;

namespace SmartWMS.Api.Controllers;

[Authorize(Roles = "Admin")]
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public class UsersController : ControllerBase
{
    private readonly IMediator _mediator;
    public UsersController(IMediator mediator) => _mediator = mediator;

    [HttpGet("list")]
    public async Task<IActionResult> GetList()
        => (await _mediator.Send(new GetUserListQuery())).ToActionResult();

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
        => (await _mediator.Send(new GetUserByIdQuery(id))).ToActionResult();

    [HttpGet]
    public async Task<IActionResult> GetPaged([FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 10, [FromQuery] string? searchKeyword = null)
        => (await _mediator.Send(new GetPaginatedUsersQuery(pageNumber, pageSize, searchKeyword))).ToActionResult();

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateUserCommand command)
        => (await _mediator.Send(command)).ToActionResult();

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateUserCommand command)
    {
        if (id != command.Id) return BadRequest(new { isSuccess = false, message = "ID không trùng khớp." });
        return (await _mediator.Send(command)).ToActionResult();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
        => (await _mediator.Send(new DeleteUserCommand(id))).ToActionResult();
}