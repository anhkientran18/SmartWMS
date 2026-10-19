using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Warehouses.DTOs;
using SmartWMS.Application.Features.Warehouses.DTOs.Queries;

namespace SmartWMS.Application.Features.Warehouses.Queries.GetPaginatedWarehouses;

public record GetPaginatedWarehousesQuery(WarehousePaginatedListQueryRequest RequestData) : IRequest<Result<PaginatedResult<WarehouseDto>>>;