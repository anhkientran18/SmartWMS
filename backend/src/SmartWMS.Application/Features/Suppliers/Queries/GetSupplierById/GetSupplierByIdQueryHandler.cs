using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Suppliers.DTOs;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Suppliers.Queries.GetSupplierById;

public sealed class GetSupplierByIdQueryHandler : IRequestHandler<GetSupplierByIdQuery, Result<SupplierDto>>
{
    private readonly IApplicationDbContext _context;

    public GetSupplierByIdQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<SupplierDto>> Handle(GetSupplierByIdQuery request, CancellationToken cancellationToken)
    {
        // Thay request.RequestData.Id bằng request.Id
        var supplier = await _context.Suppliers
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.Id && !x.IsDeleted, cancellationToken);

        if (supplier == null)
        {
            return Result<SupplierDto>.Failure(ErrorCodeConstants.NotFound, "Không tìm thấy thông tin nhà cung cấp.");
        }

        var dto = new SupplierDto
        {
            Id = supplier.Id,
            Code = supplier.Code,
            Name = supplier.Name,
            Email = supplier.Email,
            Phone = supplier.Phone,
            Address = supplier.Address
        };

        return Result<SupplierDto>.Success(dto);
    }
}