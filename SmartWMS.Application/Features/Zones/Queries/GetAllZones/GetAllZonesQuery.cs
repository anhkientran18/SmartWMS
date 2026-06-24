using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Zones.Dtos;

namespace SmartWMS.Application.Features.Zones.Queries.GetAllZones;

public record GetAllZonesQuery : IRequest<Result<List<ZoneDto>>>;