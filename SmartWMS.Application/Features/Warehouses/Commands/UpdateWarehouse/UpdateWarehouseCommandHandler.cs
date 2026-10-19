using MediatR;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Warehouses.Specifications.Commands;
using SmartWMS.Domain.Entities;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Warehouses.Commands.UpdateWarehouse;

public sealed class UpdateWarehouseCommandHandler : IRequestHandler<UpdateWarehouseCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;

    public UpdateWarehouseCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<bool>> Handle(UpdateWarehouseCommand request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<Warehouse>();
        var reqData = request.RequestData;

        var updateSpec = new WarehouseByIdForUpdateSpec(reqData.Id);
        var warehouse = await repo.GetEntityWithSpecAsync(updateSpec, cancellationToken);

        if (warehouse == null)
            return Result<bool>.Failure(ErrorCodeConstants.ValidationError, "Không tìm thấy cơ sở kho yêu cầu.");

        var codeSpec = new WarehouseByCodeForUpdateSpec(reqData.Id, reqData.Code);
        if (await repo.AnyAsync(codeSpec, cancellationToken))
            return Result<bool>.Failure(ErrorCodeConstants.ValidationError, "Mã kho này đã được sử dụng cho một cơ sở khác.");

        warehouse.Code = reqData.Code;
        warehouse.Name = reqData.Name;
        warehouse.Address = reqData.Address;

        repo.Update(warehouse);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, "Cập nhật thành công thông tin kho.");
    }
}