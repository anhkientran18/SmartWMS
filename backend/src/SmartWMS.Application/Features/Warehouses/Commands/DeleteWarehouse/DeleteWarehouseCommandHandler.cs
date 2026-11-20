using MediatR;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Warehouses.Specifications.Commands;
using SmartWMS.Domain.Entities;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Warehouses.Commands.DeleteWarehouse;

public sealed class DeleteWarehouseCommandHandler : IRequestHandler<DeleteWarehouseCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;

    public DeleteWarehouseCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<bool>> Handle(DeleteWarehouseCommand request, CancellationToken cancellationToken)
    {
        var warehouseRepo = _unitOfWork.Repository<Warehouse>();
        var zoneRepo = _unitOfWork.Repository<Zone>();
        var reqData = request.RequestData;

        var whSpec = new WarehouseByIdForUpdateSpec(reqData.Id);
        var warehouse = await warehouseRepo.GetEntityWithSpecAsync(whSpec, cancellationToken);

        if (warehouse == null)
            return Result<bool>.Failure(ErrorCodeConstants.ValidationError, "Không tìm thấy cơ sở kho yêu cầu tháo dỡ.");

        // Ràng buộc: Không được xóa nếu kho đang chứa các khu vực (Zone)
        var zoneCheckSpec = new WarehouseZoneCheckForDeleteSpec(reqData.Id);
        if (await zoneRepo.AnyAsync(zoneCheckSpec, cancellationToken))
            return Result<bool>.Failure(ErrorCodeConstants.ValidationError, $"Không thể tháo dỡ {warehouse.Name} vì vẫn còn chứa các phân khu hoạt động.");

        // Soft Delete (Xóa mềm)
        warehouse.IsDeleted = true;

        warehouseRepo.Update(warehouse);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, $"Đã đóng cửa và gỡ bỏ cơ sở {warehouse.Name} thành công.");
    }
}