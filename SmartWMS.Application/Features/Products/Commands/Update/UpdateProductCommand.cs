using MediatR;
using SmartWMS.Application.Common.Models;

namespace SmartWMS.Application.Features.Products.Commands;

public record UpdateProductCommand : IRequest<Result<bool>>
{
    public Guid Id { get; init; }
    public string SKU { get; init; } = string.Empty;
    public string Barcode { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public string Unit { get; init; } = "Cái";
}