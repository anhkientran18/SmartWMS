using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.CycleCounting.DTOs.Queries;

namespace SmartWMS.Application.Features.CycleCounting.Queries.GetCycleCountAssignees;

public sealed class GetCycleCountAssigneesQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetCycleCountAssigneesQuery, Result<List<CycleCountAssigneeDto>>>
{
    public async Task<Result<List<CycleCountAssigneeDto>>> Handle(GetCycleCountAssigneesQuery request, CancellationToken ct)
    {
        var assignees = await context.Users.AsNoTracking()
            .Where(x => x.IsActive && x.Role == "Staff")
            .OrderBy(x => x.Username).ThenBy(x => x.Id)
            .Select(x => new CycleCountAssigneeDto(x.Id, x.Username, (x.LastName + " " + x.FirstName).Trim()))
            .ToListAsync(ct);
        return Result<List<CycleCountAssigneeDto>>.Success(assignees);
    }
}
