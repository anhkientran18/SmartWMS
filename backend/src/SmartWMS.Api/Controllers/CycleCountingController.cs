using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartWMS.Api.Extensions;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Features.CycleCounting.Commands.CreateCountSheet;
using SmartWMS.Application.Features.CycleCounting.Commands.ConfirmCycleCount;
using SmartWMS.Application.Features.CycleCounting.DTOs.Commands;
using SmartWMS.Application.Features.CycleCounting.DTOs.Queries;
using SmartWMS.Application.Features.CycleCounting.Queries.GetCountSheetById;
using SmartWMS.Application.Features.CycleCounting.Queries.GetPendingCountTasks;
using SmartWMS.Application.Features.CycleCounting.Queries.GetCycleCountAssignees;

namespace SmartWMS.Api.Controllers; // Giữ nguyên namespace gốc của bạn nếu các controller khác đang dùng namespace này

[Authorize]
[Route("api/v1/[controller]")]
[ApiController]
public class CycleCountingController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ICurrentUserService _currentUserService;

    public CycleCountingController(IMediator mediator, ICurrentUserService currentUserService)
    {
        _mediator = mediator;
        _currentUserService = currentUserService;
    }

    [Authorize(Roles = "Admin,WarehouseManager")]
    [HttpGet("assignees")]
    public async Task<IActionResult> GetAssignees(CancellationToken cancellationToken)
        => (await _mediator.Send(new GetCycleCountAssigneesQuery(), cancellationToken)).ToActionResult();

    [Authorize(Roles = "Admin,WarehouseManager")]
    [HttpPost("create-sheet")]
    public async Task<IActionResult> CreateSheet([FromBody] CreateCountSheetCommand command)
        => (await _mediator.Send(command)).ToActionResult();

    [Authorize(Roles = "Admin,WarehouseManager,Staff")]
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetDetails(Guid id, CancellationToken cancellationToken)
        => (await _mediator.Send(new GetCountSheetByIdQuery(new CountSheetByIdRequest { Id = id }), cancellationToken)).ToActionResult();

    [Authorize(Roles = "Admin,WarehouseManager,Staff")]
    [HttpPost("confirm")]
    public async Task<IActionResult> Confirm([FromBody] ConfirmCycleCountRequest request, CancellationToken cancellationToken)
        => (await _mediator.Send(new ConfirmCycleCountCommand(request), cancellationToken)).ToActionResult();

    [HttpGet("pending-tasks")]
    public async Task<IActionResult> GetPendingTasks([FromQuery] string? operatorName = null)
    {
        // Legacy operatorName is accepted for compatibility; it cannot override authenticated assignment.
        return (await _mediator.Send(new GetPendingCountTasksQuery())).ToActionResult();
    }
}
