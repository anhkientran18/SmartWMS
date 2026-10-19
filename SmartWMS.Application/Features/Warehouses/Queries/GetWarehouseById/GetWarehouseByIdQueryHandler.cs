using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Warehouses.DTOs;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Warehouses.Queries.GetWarehouseById;

public sealed class GetWarehouseByIdQueryHandler : IRequestHandler<GetWarehouseByIdQuery, Result<WarehouseDto>>
{
    private readonly IApplicationDbContext _context;

    public GetWarehouseByIdQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<WarehouseDto>> Handle(GetWarehouseByIdQuery request, CancellationToken cancellationToken)
    {
        var warehouse = await _context.Warehouses
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.RequestData.Id && !x.IsDeleted, cancellationToken);

        if (warehouse == null)
        {
            return Result<WarehouseDto>.Failure(ErrorCodeConstants.NotFound, "Không tìm thấy nhà kho yêu cầu.");
        }

        var dto = new WarehouseDto
        {
            Id = warehouse.Id,
            Code = warehouse.Code,
            Name = warehouse.Name,
            Address = warehouse.Address
        };

        return Result<WarehouseDto>.Success(dto);
    }
}