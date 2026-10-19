using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Products.DTOs;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Products.Queries.GetProductById;

public sealed class GetProductByIdQueryHandler : IRequestHandler<GetProductByIdQuery, Result<ProductDto>>
{
    private readonly IApplicationDbContext _context;

    public GetProductByIdQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<ProductDto>> Handle(GetProductByIdQuery request, CancellationToken cancellationToken)
    {
        var product = await _context.Products
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.RequestData.Id && !x.IsDeleted, cancellationToken);

        if (product == null)
        {
            return Result<ProductDto>.Failure(ErrorCodeConstants.NotFound, "Không tìm thấy thông tin sản phẩm.");
        }

        var dto = new ProductDto
        {
            Id = product.Id,
            SKU = product.SKU ?? string.Empty,
            Name = product.Name ?? string.Empty,
            Description = product.Description ?? string.Empty,
            Unit = product.Unit ?? string.Empty
        };

        return Result<ProductDto>.Success(dto);
    }
}