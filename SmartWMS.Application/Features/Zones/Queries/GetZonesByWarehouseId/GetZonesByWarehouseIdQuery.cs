using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Zones.DTOs;
using SmartWMS.Application.Features.Zones.DTOs.Queries;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.Zones.Queries.GetZonesByWarehouseId;

public record GetZonesByWarehouseIdQuery(ZoneByWarehouseIdQueryRequest RequestData) : IRequest<Result<List<ZoneDto>>>;