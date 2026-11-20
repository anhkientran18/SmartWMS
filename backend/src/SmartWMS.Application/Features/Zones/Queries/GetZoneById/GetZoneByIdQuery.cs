using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Zones.DTOs;
using SmartWMS.Application.Features.Zones.DTOs.Queries;

namespace SmartWMS.Application.Features.Zones.Queries.GetZoneById;

public record GetZoneByIdQuery(ZoneByIdQueryRequest RequestData) : IRequest<Result<ZoneDto>>;