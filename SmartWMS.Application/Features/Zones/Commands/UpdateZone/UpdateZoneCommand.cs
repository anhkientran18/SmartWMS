using MediatR;
using SmartWMS.Application.Common.Models;

namespace SmartWMS.Application.Features.Zones.Commands;

public record UpdateZoneCommand(Guid Id, string Name, Guid WarehouseId) : IRequest<Result<bool>>;