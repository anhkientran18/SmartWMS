using MediatR;
using SmartWMS.Application.Common.Models;

namespace SmartWMS.Application.Features.Zones.Commands;

public record CreateZoneCommand(string Name, Guid WarehouseId) : IRequest<Result<Guid>>;