using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Zones.DTOs.Commands;

namespace SmartWMS.Application.Features.Zones.Commands.DeleteZone;

public record DeleteZoneCommand(DeleteZoneRequest RequestData) : IRequest<Result<bool>>;