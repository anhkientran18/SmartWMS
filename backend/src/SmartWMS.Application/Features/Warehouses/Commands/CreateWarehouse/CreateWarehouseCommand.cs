using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Warehouses.DTOs.Commands;
using System;

namespace SmartWMS.Application.Features.Warehouses.Commands.CreateWarehouse;

public record CreateWarehouseCommand(CreateWarehouseRequest RequestData) : IRequest<Result<Guid>>;