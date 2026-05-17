using MediatR;
using SmartWMS.Application.Common.Models;

namespace SmartWMS.Application.Features.OutboundIssues.Commands;

public record CreateOutboundIssueCommand : IRequest<Result<Guid>>
{
    public string SKU { get; init; } = string.Empty;
    public int Quantity { get; init; }
    public Guid BinId { get; init; }
    public string? Reason { get; init; } // Ví dụ: "Xuất bán", "Xuất hủy"
}