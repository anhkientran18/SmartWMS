using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Warehouses.DTOs.Commands;

namespace SmartWMS.Application.Features.Warehouses.Commands.DeleteWarehouse;

public record DeleteWarehouseCommand(DeleteWarehouseRequest RequestData) : IRequest<Result<bool>>;