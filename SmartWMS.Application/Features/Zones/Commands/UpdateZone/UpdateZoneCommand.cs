using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Zones.DTOs.Commands;

namespace SmartWMS.Application.Features.Zones.Commands.UpdateZone;

public record UpdateZoneCommand(UpdateZoneRequest RequestData) : IRequest<Result<bool>>;