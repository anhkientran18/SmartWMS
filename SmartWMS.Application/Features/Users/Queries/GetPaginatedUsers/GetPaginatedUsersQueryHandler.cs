using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Users.Dtos;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Users.Queries.GetPaginatedUsers;

public class GetPaginatedUsersQueryHandler : IRequestHandler<GetPaginatedUsersQuery, Result<UserPaginationDto>>
{
    private readonly IApplicationDbContext _context;

    public GetPaginatedUsersQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<UserPaginationDto>> Handle(GetPaginatedUsersQuery request, CancellationToken cancellationToken)
    {
        var query = _context.Users.AsNoTracking().AsQueryable();

        // 1. Lọc theo từ khóa (Đã gỡ bỏ toàn bộ .ToLower() trên cột DB để bảo vệ an toàn cho Index)
        if (!string.IsNullOrWhiteSpace(request.SearchKeyword))
        {
            var keyword = request.SearchKeyword.Trim();
            query = query.Where(u => u.Username.Contains(keyword) ||
                                     u.Email.Contains(keyword) ||
                                     u.FirstName.Contains(keyword) || // Tìm theo Tên
                                     u.LastName.Contains(keyword));   // Tìm theo Họ
        }

        // 2. Đếm tổng số bản ghi thỏa mãn điều kiện lọc
        var totalRecords = await query.CountAsync(cancellationToken);

        // 3. Phân trang, lấy dữ liệu và Map thẳng sang DTO gọn nhẹ
        var items = await query
            .OrderByDescending(u => u.Id) // Ưu tiên xếp các tài khoản mới tạo lên đầu danh sách
            .Skip((request.PageNumber - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(u => new UserDto
            {
                Id = u.Id,
                Username = u.Username,
                Email = u.Email,
                FirstName = u.FirstName,
                LastName = u.LastName,
                FullName = u.LastName + " " + u.FirstName, // Ép dịch chuỗi T-SQL tối ưu
                Role = u.Role,
                IsActive = u.IsActive
            })
            .ToListAsync(cancellationToken);

        // 4. Đóng gói mô hình kết quả phân trang
        var resultDto = new UserPaginationDto
        {
            TotalRecords = totalRecords,
            TotalPages = (int)Math.Ceiling(totalRecords / (double)request.PageSize),
            Items = items
        };

        return Result<UserPaginationDto>.Success(resultDto);
    }
}