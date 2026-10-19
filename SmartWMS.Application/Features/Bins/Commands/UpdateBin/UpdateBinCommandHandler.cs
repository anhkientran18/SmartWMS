using MediatR;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Bins.Specifications.Commands;
using SmartWMS.Domain.Entities;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Bins.Commands.UpdateBin;

public sealed class UpdateBinCommandHandler : IRequestHandler<UpdateBinCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;

    public UpdateBinCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<bool>> Handle(UpdateBinCommand request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<Bin>();
        var reqData = request.RequestData;

        // 1. Lấy thông tin kệ cần sửa
        var updateSpec = new BinByIdForUpdateSpec(reqData.Id);
        var bin = await repo.GetEntityWithSpecAsync(updateSpec, cancellationToken);

        if (bin == null)
            return Result<bool>.Failure(ErrorCodeConstants.BinNotFound, "Không tìm thấy ô kệ yêu cầu chỉnh sửa.");

        // 2. Kiểm tra trùng mã kệ trong cùng Zone
        var codeSpec = new BinByCodeAndZoneForUpdateSpec(reqData.Id, reqData.Code, bin.ZoneId);
        if (await repo.AnyAsync(codeSpec, cancellationToken))
            return Result<bool>.Failure(ErrorCodeConstants.ValidationError, "Mã ô kệ này đã tồn tại trong khu vực.");

        // 3. Ràng buộc doanh nghiệp (Capacity)
        if (reqData.MaxCapacity < bin.CurrentOccupancy)
            return Result<bool>.Failure(ErrorCodeConstants.ValidationError, $"Sức chứa mới ({reqData.MaxCapacity}) không được nhỏ hơn lượng hàng đang nằm trên kệ ({bin.CurrentOccupancy}).");

        bin.Code = reqData.Code;
        bin.MaxCapacity = reqData.MaxCapacity;

        repo.Update(bin);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, $"Cập nhật thành công cấu hình ô kệ {bin.Code}.");
    }
}