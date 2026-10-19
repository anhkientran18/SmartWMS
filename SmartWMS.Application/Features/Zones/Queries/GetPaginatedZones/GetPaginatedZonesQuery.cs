using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Zones.DTOs;
using SmartWMS.Application.Features.Zones.DTOs.Queries;

namespace SmartWMS.Application.Features.Zones.Queries.GetPaginatedZones;

public record GetPaginatedZonesQuery(ZonePaginatedListQueryRequest RequestData) : IRequest<Result<PaginatedResult<ZoneDto>>>;