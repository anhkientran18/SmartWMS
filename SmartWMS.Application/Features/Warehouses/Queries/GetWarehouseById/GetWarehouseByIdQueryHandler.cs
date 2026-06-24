using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Warehouses.Dtos;

namespace SmartWMS.Application.Features.Warehouses.Queries;

public class GetWarehouseByIdQueryHandler : IRequestHandler<GetWarehouseByIdQuery, Result<WarehouseDto>>
{
    private readonly IApplicationDbContext _context;

    public GetWarehouseByIdQueryHandler(IApplicationDbContext context) => _context = context;

    public async Task<Result<WarehouseDto>> Handle(GetWarehouseByIdQuery request, CancellationToken cancellationToken)
    {
        var w = await _context.Warehouses.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.Id, cancellationToken);

        if (w == null)
            return Result<WarehouseDto>.Failure("Không tìm thấy kho tổng.");

        var dto = new WarehouseDto
        {
            Id = w.Id,
            Name = w.Name,
            Address = w.Address ?? string.Empty
        };

        return Result<WarehouseDto>.Success(dto);
    }
}