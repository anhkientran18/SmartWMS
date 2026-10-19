using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Suppliers.DTOs;

namespace SmartWMS.Application.Features.Suppliers.Queries.GetPaginatedSuppliers;

public class GetPaginatedSuppliersQueryHandler : IRequestHandler<GetPaginatedSuppliersQuery, Result<PaginatedResult<SupplierDto>>>
{
    private readonly IApplicationDbContext _context;

    public GetPaginatedSuppliersQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<PaginatedResult<SupplierDto>>> Handle(GetPaginatedSuppliersQuery request, CancellationToken cancellationToken)
    {
        var query = _context.Suppliers.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(request.SearchTerm))
        {
            var searchTerm = request.SearchTerm.ToLower();
            query = query.Where(x =>
                x.Code.ToLower().Contains(searchTerm) ||
                x.Name.ToLower().Contains(searchTerm) ||
                x.Phone.Contains(searchTerm) ||
                x.Email.ToLower().Contains(searchTerm));
        }

        query = query.OrderBy(x => x.Name);

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .Skip((request.PageNumber - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(s => new SupplierDto
            {
                Id = s.Id,
                Code = s.Code,
                Name = s.Name,
                Email = s.Email,
                Phone = s.Phone,
                Address = s.Address
            })
            .ToListAsync(cancellationToken);

        // Đóng gói dữ liệu bằng PaginatedResult chuẩn của hệ thống
        var paginatedResult = new PaginatedResult<SupplierDto>(items, totalCount, request.PageNumber, request.PageSize);

        // Lưu ý: Nếu class PaginatedResult của bạn bắt buộc dùng hàm tĩnh Create(), 
        // hãy xóa dòng trên và mở comment dòng dưới:
        // var paginatedResult = PaginatedResult<SupplierDto>.Create(items, totalCount, request.PageNumber, request.PageSize);

        return Result<PaginatedResult<SupplierDto>>.Success(paginatedResult);
    }
}