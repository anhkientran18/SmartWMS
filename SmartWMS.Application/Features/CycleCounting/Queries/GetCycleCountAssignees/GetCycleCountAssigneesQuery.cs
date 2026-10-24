using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.CycleCounting.DTOs.Queries;

namespace SmartWMS.Application.Features.CycleCounting.Queries.GetCycleCountAssignees;

public sealed record GetCycleCountAssigneesQuery : IRequest<Result<List<CycleCountAssigneeDto>>>;
