using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Bins.DTOs;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Bins.Queries.GetPaginatedBinsByZoneId;

public class GetPaginatedBinsByZoneIdQueryHandler : IRequestHandler<GetPaginatedBinsByZoneIdQuery, Result<PaginatedResult<BinDto>>>
{
    private readonly IApplicationDbContext _context;

    public GetPaginatedBinsByZoneIdQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<PaginatedResult<BinDto>>> Handle(GetPaginatedBinsByZoneIdQuery request, CancellationToken cancellationToken)
    {
        var reqData = request.RequestData;

        // 1. Khởi tạo Query lọc các ô kệ chưa bị xóa (AsNoTracking để tối ưu tốc độ đọc)
        var query = _context.Bins
            .AsNoTracking()
            .Where(b => !b.IsDeleted);

        // 2. Lọc theo ZoneId (nếu có truyền lên)
        if (reqData.ZoneId.HasValue && reqData.ZoneId.Value != Guid.Empty)
        {
            query = query.Where(b => b.ZoneId == reqData.ZoneId.Value);
        }

        // 3. Lọc theo SearchTerm (nếu có)
        if (!string.IsNullOrWhiteSpace(reqData.SearchTerm))
        {
            var search = reqData.SearchTerm.Trim().ToLower();
            query = query.Where(b => b.Code.ToLower().Contains(search));
        }

        // 4. Đếm tổng số bản ghi
        var totalCount = await query.CountAsync(cancellationToken);

        // 5. Phân trang, Sắp xếp và Select DTO trực tiếp xuống Database
        var dtoItems = await query
            .OrderBy(b => b.Code)
            .Skip((reqData.PageNumber - 1) * reqData.PageSize)
            .Take(reqData.PageSize)
            .Select(b => new BinDto
            {
                Purpose = b.Purpose,
                Id = b.Id,
                Code = b.Code,
                ZoneId = b.ZoneId,
                MaxCapacity = b.MaxCapacity,
                CurrentOccupancy = b.CurrentOccupancy
            })
            .ToListAsync(cancellationToken);

        // 6. Đóng gói kết quả theo PaginatedResult đúng kiểu thầy viết
        var result = PaginatedResult<BinDto>.Create(dtoItems, totalCount, reqData.PageNumber, reqData.PageSize);
        return Result<PaginatedResult<BinDto>>.Success(result);
    }
}