using MediatR;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Zones.Specifications.Commands;
using SmartWMS.Domain.Entities;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Zones.Commands.DeleteZone;

public sealed class DeleteZoneCommandHandler : IRequestHandler<DeleteZoneCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;

    public DeleteZoneCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<bool>> Handle(DeleteZoneCommand request, CancellationToken cancellationToken)
    {
        var zoneRepo = _unitOfWork.Repository<Zone>();
        var binRepo = _unitOfWork.Repository<Bin>();
        var reqData = request.RequestData;

        var zoneSpec = new ZoneByIdForUpdateSpec(reqData.Id);
        var zone = await zoneRepo.GetEntityWithSpecAsync(zoneSpec, cancellationToken);

        if (zone == null)
            return Result<bool>.Failure(ErrorCodeConstants.ZoneNotFound, "Không tìm thấy khu vực yêu cầu tháo dỡ.");

        // Ràng buộc doanh nghiệp: Không cho phép xóa Zone nếu bên trong vẫn còn Bin
        var binCheckSpec = new ZoneBinCheckForDeleteSpec(reqData.Id);
        if (await binRepo.AnyAsync(binCheckSpec, cancellationToken))
            return Result<bool>.Failure(ErrorCodeConstants.ValidationError, $"Không thể tháo dỡ khu vực {zone.Name} vì vẫn còn các ô kệ trực thuộc.");

        // Nếu bảng Zone của bạn chưa cấu hình IsDeleted, hãy đổi thành Delete cứng: zoneRepo.Delete(zone);
        zoneRepo.Delete(zone);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, $"Đã tháo dỡ khu vực {zone.Name} thành công.");
    }
}