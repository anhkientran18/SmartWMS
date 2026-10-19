using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Customers.DTOs;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Customers.Queries.GetCustomerList;

public class GetCustomerListQueryHandler : IRequestHandler<GetCustomerListQuery, Result<List<CustomerDto>>>
{
    private readonly IApplicationDbContext _context;

    public GetCustomerListQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<List<CustomerDto>>> Handle(GetCustomerListQuery request, CancellationToken cancellationToken)
    {
        var customers = await _context.Customers
            .AsNoTracking()
            .Where(c => !c.IsDeleted)
            .Select(c => new CustomerDto
            {
                Id = c.Id,
                Code = c.Code,
                Name = c.Name,
                Email = c.Email,
                Phone = c.Phone,
                Address = c.Address
            })
            .ToListAsync(cancellationToken);

        return Result<List<CustomerDto>>.Success(customers);
    }
}