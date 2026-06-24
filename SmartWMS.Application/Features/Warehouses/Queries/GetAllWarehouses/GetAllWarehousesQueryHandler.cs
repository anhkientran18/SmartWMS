using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Warehouses.Dtos;

namespace SmartWMS.Application.Features.Warehouses.Queries;

public class GetAllWarehousesQueryHandler : IRequestHandler<GetAllWarehousesQuery, Result<List<WarehouseDto>>>
{
    private readonly IApplicationDbContext _context;

    public GetAllWarehousesQueryHandler(IApplicationDbContext context) => _context = context;

    public async Task<Result<List<WarehouseDto>>> Handle(GetAllWarehousesQuery request, CancellationToken cancellationToken)
    {
        var list = await _context.Warehouses.AsNoTracking()
            .Select(w => new WarehouseDto
            {
                Id = w.Id,
                Name = w.Name,
                Address = w.Address ?? string.Empty
            })
            .ToListAsync(cancellationToken);

        return Result<List<WarehouseDto>>.Success(list);
    }
}