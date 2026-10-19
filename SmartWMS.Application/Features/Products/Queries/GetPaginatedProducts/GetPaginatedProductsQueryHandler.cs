using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Products.DTOs;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Products.Queries.GetPaginatedProducts;

public sealed class GetPaginatedProductsQueryHandler : IRequestHandler<GetPaginatedProductsQuery, Result<PaginatedResult<ProductDto>>>
{
    private readonly IApplicationDbContext _context;

    public GetPaginatedProductsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<PaginatedResult<ProductDto>>> Handle(GetPaginatedProductsQuery request, CancellationToken cancellationToken)
    {
        var req = request.RequestData;

        // Truy vấn trực tiếp từ cơ sở dữ liệu qua EF Core
        var query = _context.Products
            .AsNoTracking()
            .Where(x => !x.IsDeleted);

        if (!string.IsNullOrWhiteSpace(req.SearchKeyword))
        {
            var search = req.SearchKeyword.Trim().ToLower();
            query = query.Where(x => x.SKU.ToLower().Contains(search) || x.Name.ToLower().Contains(search));
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderBy(x => x.Name)
            .Skip((req.PageIndex - 1) * req.PageSize)
            .Take(req.PageSize)
            .Select(x => new ProductDto
            {
                Id = x.Id,
                SKU = x.SKU ?? string.Empty,
                Name = x.Name ?? string.Empty,
                Description = x.Description ?? string.Empty,
                Unit = x.Unit ?? string.Empty
            })
            .ToListAsync(cancellationToken);

        var result = PaginatedResult<ProductDto>.Create(items, totalCount, req.PageIndex, req.PageSize);

        return Result<PaginatedResult<ProductDto>>.Success(result);
    }
}