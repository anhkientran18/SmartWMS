using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.CycleCounting.DTOs.Commands;

namespace SmartWMS.Application.Features.CycleCounting.Commands.ConfirmCycleCount;

public record ConfirmCycleCountCommand(ConfirmCycleCountRequest RequestData) : IRequest<Result<bool>>;