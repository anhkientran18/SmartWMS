using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Warehouses.DTOs;
using SmartWMS.Application.Features.Warehouses.DTOs.Queries;

namespace SmartWMS.Application.Features.Warehouses.Queries.GetWarehouseById;

public record GetWarehouseByIdQuery(WarehouseByIdQueryRequest RequestData) : IRequest<Result<WarehouseDto>>;