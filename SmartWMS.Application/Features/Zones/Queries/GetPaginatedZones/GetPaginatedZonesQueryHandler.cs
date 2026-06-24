using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Zones.Dtos;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Zones.Queries.GetPaginatedZones;

public class GetPaginatedZonesQueryHandler : IRequestHandler<GetPaginatedZonesQuery, Result<ZonePaginationDto>>
{
    private readonly IApplicationDbContext _context;

    public GetPaginatedZonesQueryHandler(IApplicationDbContext context) => _context = context;

    public async Task<Result<ZonePaginationDto>> Handle(GetPaginatedZonesQuery request, CancellationToken cancellationToken)
    {
        var query = _context.Zones.AsNoTracking().AsQueryable();

        // 1. 🌟 ĐÃ SỬA: Chỉ lọc theo từ khóa Name (Đã loại bỏ cột Code không tồn tại)
        if (!string.IsNullOrWhiteSpace(request.SearchKeyword))
        {
            var keyword = request.SearchKeyword.Trim();
            query = query.Where(z => z.Name.Contains(keyword));
        }

        // 2. Đếm tổng số lượng phân khu thỏa mãn điều kiện
        var totalRecords = await query.CountAsync(cancellationToken);

        // 3. Phân trang và chiếu dữ liệu (Đã loại bỏ gán Code = z.Code)
        var items = await query
            .OrderByDescending(z => z.CreatedAt)
            .Skip((request.PageNumber - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(z => new ZoneDto
            {
                Id = z.Id,
                Name = z.Name,
                WarehouseId = z.WarehouseId
            })
            .ToListAsync(cancellationToken);

        // 4. Trả về kết quả đóng gói phân trang
        return Result<ZonePaginationDto>.Success(new ZonePaginationDto
        {
            TotalRecords = totalRecords,
            TotalPages = (int)Math.Ceiling(totalRecords / (double)request.PageSize),
            Items = items
        });
    }
}