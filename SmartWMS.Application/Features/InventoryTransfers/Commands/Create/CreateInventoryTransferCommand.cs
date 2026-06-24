using MediatR;
using SmartWMS.Application.Common.Models;

namespace SmartWMS.Application.Features.InventoryTransfers.Commands.Create;

public record CreateInventoryTransferCommand : IRequest<Result<bool>>
{
    public string SKU { get; init; } = string.Empty;
    public Guid SourceBinId { get; init; }
    public Guid DestinationBinId { get; init; }
    public double Quantity { get; init; }
}