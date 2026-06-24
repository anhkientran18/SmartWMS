using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Products.Dtos;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Products.Queries.GetPaginatedProducts;

public class GetPaginatedProductsQueryHandler : IRequestHandler<GetPaginatedProductsQuery, Result<ProductPaginationDto>>
{
    private readonly IApplicationDbContext _context;

    public GetPaginatedProductsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<ProductPaginationDto>> Handle(GetPaginatedProductsQuery request, CancellationToken cancellationToken)
    {
        var query = _context.Products.AsNoTracking().AsQueryable();

        // Lọc theo từ khóa (Đã loại bỏ hoàn toàn .ToLower() để bảo vệ an toàn cho Index Database)
        if (!string.IsNullOrWhiteSpace(request.SearchKeyword))
        {
            var keyword = request.SearchKeyword.Trim();
            query = query.Where(p => p.Name.Contains(keyword) ||
                                     p.SKU.Contains(keyword) ||
                                     p.Barcode.Contains(keyword));
        }

        // Đếm tổng số bản ghi thỏa mãn điều kiện lọc
        var totalRecords = await query.CountAsync(cancellationToken);

        // Thực thi phân trang và chiếu dữ liệu (Projection) sang DTO bản ghi gọn nhẹ
        var items = await query
            .OrderByDescending(p => p.CreatedAt) // Ưu tiên đưa hàng mới khởi tạo lên đầu danh sách
            .Skip((request.PageNumber - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(p => new ProductDto
            {
                Id = p.Id,
                SKU = p.SKU,
                Barcode = p.Barcode,
                Name = p.Name,
                Description = p.Description ?? string.Empty,
                Unit = p.Unit ?? string.Empty
            })
            .ToListAsync(cancellationToken);

        var resultDto = new ProductPaginationDto
        {
            TotalRecords = totalRecords,
            TotalPages = (int)Math.Ceiling(totalRecords / (double)request.PageSize),
            Items = items
        };

        return Result<ProductPaginationDto>.Success(resultDto);
    }
}