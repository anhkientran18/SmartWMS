using MediatR;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;

namespace SmartWMS.Application.Features.Warehouses.Commands;

public class UpdateWarehouseCommandHandler : IRequestHandler<UpdateWarehouseCommand, Result<bool>>
{
    private readonly IApplicationDbContext _context;

    public UpdateWarehouseCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task<Result<bool>> Handle(UpdateWarehouseCommand request, CancellationToken cancellationToken)
    {
        var warehouse = await _context.Warehouses.FindAsync(new object[] { request.Id }, cancellationToken);

        if (warehouse == null)
            return Result<bool>.Failure("Không tìm thấy kho tổng cần cập nhật.");

        warehouse.Code = request.Code;
        warehouse.Name = request.Name;
        warehouse.Address = request.Address;

        await _context.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, "Cập nhật thông tin kho tổng thành công.");
    }
}