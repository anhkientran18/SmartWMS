using MediatR;
using SmartWMS.Application.Common.Models;

namespace SmartWMS.Application.Features.Warehouses.Commands;

public record UpdateWarehouseCommand(Guid Id, string Code, string Name, string Address) : IRequest<Result<bool>>;