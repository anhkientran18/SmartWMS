using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Products.Dtos;

namespace SmartWMS.Application.Features.Products.Queries;

public class GetProductByIdQueryHandler : IRequestHandler<GetProductByIdQuery, Result<ProductDto>>
{
    private readonly IApplicationDbContext _context;

    public GetProductByIdQueryHandler(IApplicationDbContext context) => _context = context;

    public async Task<Result<ProductDto>> Handle(GetProductByIdQuery request, CancellationToken cancellationToken)
    {
        var product = await _context.Products
            .AsNoTracking() // Tối ưu tốc độ đọc, không theo dõi thay đổi
            .FirstOrDefaultAsync(p => p.Id == request.Id, cancellationToken);

        if (product == null)
            return Result<ProductDto>.Failure("Không tìm thấy sản phẩm.");

        var dto = new ProductDto
        {
            Id = product.Id,
            SKU = product.SKU,
            Barcode = product.Barcode,
            Name = product.Name,
            Description = product.Description ?? string.Empty,
            Unit = product.Unit ?? string.Empty
        };

        return Result<ProductDto>.Success(dto);
    }
}