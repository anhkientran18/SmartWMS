using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Warehouses.Dtos;

namespace SmartWMS.Application.Features.Warehouses.Queries;

public record GetWarehouseByIdQuery(Guid Id) : IRequest<Result<WarehouseDto>>;