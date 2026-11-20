using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Warehouses.DTOs.Commands;

namespace SmartWMS.Application.Features.Warehouses.Commands.UpdateWarehouse;

public record UpdateWarehouseCommand(UpdateWarehouseRequest RequestData) : IRequest<Result<bool>>;