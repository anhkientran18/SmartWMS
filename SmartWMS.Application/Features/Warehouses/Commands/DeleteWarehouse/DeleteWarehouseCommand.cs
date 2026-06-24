using MediatR;
using SmartWMS.Application.Common.Models;

namespace SmartWMS.Application.Features.Warehouses.Commands;

public record DeleteWarehouseCommand(Guid Id) : IRequest<Result<bool>>;