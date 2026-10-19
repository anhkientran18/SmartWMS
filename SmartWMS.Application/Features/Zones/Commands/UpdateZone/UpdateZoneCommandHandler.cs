using MediatR;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Zones.Specifications.Commands;
using SmartWMS.Domain.Entities;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Zones.Commands.UpdateZone;

public sealed class UpdateZoneCommandHandler : IRequestHandler<UpdateZoneCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;

    public UpdateZoneCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<bool>> Handle(UpdateZoneCommand request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<Zone>();
        var reqData = request.RequestData;

        var updateSpec = new ZoneByIdForUpdateSpec(reqData.Id);
        var zone = await repo.GetEntityWithSpecAsync(updateSpec, cancellationToken);

        if (zone == null)
            return Result<bool>.Failure(ErrorCodeConstants.ZoneNotFound, "Không tìm thấy khu vực yêu cầu chỉnh sửa.");

        var codeSpec = new ZoneByCodeForUpdateSpec(reqData.Id, reqData.Code, zone.WarehouseId);
        if (await repo.AnyAsync(codeSpec, cancellationToken))
            return Result<bool>.Failure(ErrorCodeConstants.ValidationError, "Mã khu vực này đã tồn tại.");

        zone.Code = reqData.Code;
        zone.Name = reqData.Name;

        repo.Update(zone);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, "Cập nhật thành công cấu hình khu vực.");
    }
}