using SmartWMS.Application.Common.Models;
using MediatR;

namespace SmartWMS.Application.Features.InboundReceipts.Commands.Create;

public record CreateInboundReceiptCommand : IRequest<Result<Guid>>
{
    public string SKU { get; init; } = string.Empty;
    public int Quantity { get; init; }
    public Guid BinId { get; init; }
    public string? Notes { get; init; }
}