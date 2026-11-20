using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.CycleCounting.DTOs.Commands;

namespace SmartWMS.Application.Features.CycleCounting.Commands.ScheduleAutoCycleCount;

public record ScheduleAutoCycleCountCommand(ScheduleAutoCycleCountRequest RequestData) : IRequest<Result<bool>>;