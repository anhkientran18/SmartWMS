using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Warehouses.DTOs;
using SmartWMS.Application.Features.Warehouses.DTOs.Queries;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.Warehouses.Queries.GetList;

public record GetWarehouseListQuery(WarehouseListQueryRequest RequestData) : IRequest<Result<List<WarehouseDto>>>;