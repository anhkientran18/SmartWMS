using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Suppliers.DTOs;
using SmartWMS.Application.Features.Suppliers.Queries.GetSupplierList;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Suppliers.Queries.GetList;

public sealed class GetSupplierListQueryHandler : IRequestHandler<GetSupplierListQuery, Result<List<SupplierDto>>>
{
    private readonly IApplicationDbContext _context;

    public GetSupplierListQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<List<SupplierDto>>> Handle(GetSupplierListQuery request, CancellationToken cancellationToken)
    {
        var items = await _context.Suppliers
            .AsNoTracking()
            .Where(x => !x.IsDeleted)
            .OrderBy(x => x.Name)
            .Select(x => new SupplierDto
            {
                Id = x.Id,
                Code = x.Code,
                Name = x.Name,
                Email = x.Email,
                Phone = x.Phone,
                Address = x.Address
            })
            .ToListAsync(cancellationToken);

        return Result<List<SupplierDto>>.Success(items);
    }
}