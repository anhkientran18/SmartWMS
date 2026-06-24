using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Warehouses.Dtos; // 🌟 ĐÃ ĐỒNG BỘ: Chuyển sang dùng 'Dtos' viết thường

namespace SmartWMS.Application.Features.Warehouses.Queries.GetPaginatedWarehouses;

public class GetPaginatedWarehousesQueryHandler : IRequestHandler<GetPaginatedWarehousesQuery, Result<WarehousePaginationDto>>
{
    private readonly IApplicationDbContext _context;

    public GetPaginatedWarehousesQueryHandler(IApplicationDbContext context) => _context = context;

    public async Task<Result<WarehousePaginationDto>> Handle(GetPaginatedWarehousesQuery request, CancellationToken cancellationToken)
    {
        var query = _context.Warehouses.AsNoTracking().AsQueryable();

        // Lọc theo từ khóa (🌟 ĐÃ TỐI ƯU: Loại bỏ .ToLower() để bảo vệ an toàn và kích hoạt Index Seek siêu tốc)
        if (!string.IsNullOrWhiteSpace(request.SearchKeyword))
        {
            var keyword = request.SearchKeyword.Trim();
            query = query.Where(w => w.Name.Contains(keyword) ||
                                     w.Code.Contains(keyword));
        }

        var totalRecords = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(w => w.CreatedAt)
            .Skip((request.PageNumber - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(w => new WarehouseDto
            {
                Id = w.Id,
                Name = w.Name,
                Code = w.Code,
                Address = w.Address ?? string.Empty
            })
            .ToListAsync(cancellationToken);

        return Result<WarehousePaginationDto>.Success(new WarehousePaginationDto
        {
            TotalRecords = totalRecords,
            TotalPages = (int)Math.Ceiling(totalRecords / (double)request.PageSize),
            Items = items
        });
    }
}