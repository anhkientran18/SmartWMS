using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Zones.DTOs;
using SmartWMS.Application.Features.Zones.DTOs.Queries;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.Zones.Queries.GetList;

public record GetZoneListQuery(ZoneListQueryRequest RequestData) : IRequest<Result<List<ZoneDto>>>;