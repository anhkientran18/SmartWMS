using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Dashboard.DTOs.Queries;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.Dashboard.Queries.GetWarehouseOccupancy;

public record GetWarehouseOccupancyQuery : IRequest<Result<List<WarehouseOccupancyDto>>>;
