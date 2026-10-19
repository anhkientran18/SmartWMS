using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Zones.DTOs.Commands;
using System;

namespace SmartWMS.Application.Features.Zones.Commands.CreateZone;

public record CreateZoneCommand(CreateZoneRequest RequestData) : IRequest<Result<Guid>>;