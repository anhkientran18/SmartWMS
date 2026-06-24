using MediatR;
using SmartWMS.Application.Common.Models;

namespace SmartWMS.Application.Features.Zones.Commands;

public record DeleteZoneCommand(Guid Id) : IRequest<Result<bool>>;