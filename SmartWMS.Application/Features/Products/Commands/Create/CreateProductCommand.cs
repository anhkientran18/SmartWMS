using MediatR;
using SmartWMS.Application.Common.Models;

namespace SmartWMS.Application.Features.Products.Commands.Create;

public record CreateProductCommand : IRequest<Result<Guid>>
{
    public string SKU { get; init; } = string.Empty;
    public string Barcode { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public string Unit { get; init; } = "Pcs"; // Đơn vị tính (Cái, Thùng,...)
    public double Width { get; init; }  // Chiều rộng (cm) để AI tính toán không gian
    public double Height { get; init; } // Chiều cao (cm)
    public double Depth { get; init; }  // Chiều sâu (cm)
}