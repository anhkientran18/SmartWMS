using MediatR;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Bins.Specifications.Commands;
using SmartWMS.Domain.Entities;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Bins.Commands.DeleteBin;

public sealed class DeleteBinCommandHandler : IRequestHandler<DeleteBinCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;

    public DeleteBinCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<bool>> Handle(DeleteBinCommand request, CancellationToken cancellationToken)
    {
        var binRepo = _unitOfWork.Repository<Bin>();
        var invRepo = _unitOfWork.Repository<BinInventory>();
        var reqData = request.RequestData;

        // 1. Lấy kệ ra
        var binSpec = new BinByIdForUpdateSpec(reqData.Id); // Tái sử dụng Spec có Tracking
        var bin = await binRepo.GetEntityWithSpecAsync(binSpec, cancellationToken);

        if (bin == null)
            return Result<bool>.Failure(ErrorCodeConstants.BinNotFound, "Không tìm thấy ô kệ yêu cầu tháo dỡ.");

        // 2. Ràng buộc doanh nghiệp (Kệ đang chứa hàng không được xóa)
        var invSpec = new BinInventoryCheckForDeleteSpec(reqData.Id);
        if (await invRepo.AnyAsync(invSpec, cancellationToken))
            return Result<bool>.Failure(ErrorCodeConstants.ValidationError, $"Không thể tháo dỡ ô kệ {bin.Code} vì đang chứa hàng hóa.");

        // 3. Thực thi Soft Delete
        bin.IsDeleted = true;
        bin.UpdatedAt = DateTime.UtcNow;
        bin.UpdatedBy = "SystemAdmin";

        binRepo.Update(bin);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, $"Đã ẩn và tháo dỡ ô kệ {bin.Code} khỏi sơ đồ vận hành.");
    }
}