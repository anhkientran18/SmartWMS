using MediatR;
using SmartWMS.Application.Common.Models;

namespace SmartWMS.Application.Features.Warehouses.Commands.CreateWarehouse;

public record CreateWarehouseCommand : IRequest<Result<Guid>>
{
    public string Name { get; init; } = string.Empty;
    public string Code { get; init; } = string.Empty;
    public string? Address { get; init; }
}