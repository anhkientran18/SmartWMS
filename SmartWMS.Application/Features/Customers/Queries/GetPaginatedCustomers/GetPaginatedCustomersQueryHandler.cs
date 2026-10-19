using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Customers.DTOs;

namespace SmartWMS.Application.Features.Customers.Queries.GetPaginatedCustomers;

public class GetPaginatedCustomersQueryHandler : IRequestHandler<GetPaginatedCustomersQuery, Result<PaginatedResult<CustomerDto>>>
{
    private readonly IApplicationDbContext _context;

    public GetPaginatedCustomersQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<PaginatedResult<CustomerDto>>> Handle(GetPaginatedCustomersQuery request, CancellationToken cancellationToken)
    {
        var query = _context.Customers.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(request.SearchTerm))
        {
            var searchTerm = request.SearchTerm.ToLower();
            query = query.Where(x =>
                x.Code.ToLower().Contains(searchTerm) ||
                x.Name.ToLower().Contains(searchTerm) ||
                x.Email.ToLower().Contains(searchTerm));
        }

        query = query.OrderBy(x => x.Name);

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .Skip((request.PageNumber - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(c => new CustomerDto
            {
                Id = c.Id,
                Code = c.Code,
                Name = c.Name,
                Email = c.Email,
                Address = c.Address // Đã sửa từ c.DeliveryAddress thành c.Address
            })
            .ToListAsync(cancellationToken);

        // Đóng gói bằng PaginatedResult chuẩn
        var paginatedResult = new PaginatedResult<CustomerDto>(items, totalCount, request.PageNumber, request.PageSize);

        return Result<PaginatedResult<CustomerDto>>.Success(paginatedResult);
    }
}