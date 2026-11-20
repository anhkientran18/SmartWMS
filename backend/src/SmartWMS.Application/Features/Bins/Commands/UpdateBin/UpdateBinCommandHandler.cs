using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Transactions;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Bins.Specifications.Commands;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Bins.Commands.UpdateBin;

public sealed class UpdateBinCommandHandler : IRequestHandler<UpdateBinCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IApplicationDbContext _context;

    public UpdateBinCommandHandler(IUnitOfWork unitOfWork, IApplicationDbContext context)
    {
        _unitOfWork = unitOfWork;
        _context = context;
    }

    public async Task<Result<bool>> Handle(UpdateBinCommand request, CancellationToken cancellationToken)
    {
        using var transaction = new TransactionScope(TransactionScopeOption.Required,
            new TransactionOptions { IsolationLevel = IsolationLevel.Serializable },
            TransactionScopeAsyncFlowOption.Enabled);
        var repo = _unitOfWork.Repository<Bin>();
        var reqData = request.RequestData;

        // 1. Lấy thông tin kệ cần sửa
        var bin = await _context.Bins.AsTracking()
            .FirstOrDefaultAsync(x => x.Id == reqData.Id && !x.IsDeleted, cancellationToken);

        if (bin == null)
            return Result<bool>.Failure(ErrorCodeConstants.BinNotFound, "Không tìm thấy ô kệ yêu cầu chỉnh sửa.");

        // 2. Kiểm tra trùng mã kệ trong cùng Zone
        var codeSpec = new BinByCodeAndZoneForUpdateSpec(reqData.Id, reqData.Code, bin.ZoneId);
        if (await repo.AnyAsync(codeSpec, cancellationToken))
            return Result<bool>.Failure(ErrorCodeConstants.ValidationError, "Mã ô kệ này đã tồn tại trong khu vực.");

        // 3. Ràng buộc doanh nghiệp (Capacity)
        if (reqData.MaxCapacity < bin.CurrentOccupancy)
            return Result<bool>.Failure(ErrorCodeConstants.ValidationError, $"Sức chứa mới ({reqData.MaxCapacity}) không được nhỏ hơn lượng hàng đang nằm trên kệ ({bin.CurrentOccupancy}).");

        if (reqData.Purpose.HasValue && reqData.Purpose.Value != bin.Purpose)
        {
            if (bin.CurrentOccupancy != 0 || await HasPurposeDependenciesAsync(bin.Id, reqData.Purpose.Value, cancellationToken))
                return Result<bool>.Failure(ErrorCodeConstants.Conflict,
                    "Không thể đổi Purpose khi ô kệ có tồn, serial, cấu hình staging hoặc chứng từ/workflow đang mở.");
            bin.Purpose = reqData.Purpose.Value;
        }

        bin.Code = reqData.Code;
        bin.MaxCapacity = reqData.MaxCapacity;

        repo.Update(bin);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        transaction.Complete();

        return Result<bool>.Success(true, $"Cập nhật thành công cấu hình ô kệ {bin.Code}.");
    }
    private async Task<bool> HasPurposeDependenciesAsync(System.Guid id, BinPurpose next, CancellationToken ct)
    {
        if (next == BinPurpose.Storage && await _context.Warehouses.AnyAsync(x => x.DefaultStagingBinId == id, ct))
            return true;
        if (await _context.BinInventories.AnyAsync(x => x.BinId == id && (x.Quantity != 0 || x.ReservedQuantity != 0), ct) ||
            await _context.ProductSerialNumbers.AnyAsync(x => x.BinInventoryId.HasValue && x.Status != "Shipped" &&
                _context.BinInventories.Any(i => i.Id == x.BinInventoryId && i.BinId == id), ct) ||
            await _context.InboundReceipts.AnyAsync(x => !x.IsDeleted && x.BinId == id && x.Status != "Completed", ct) ||
            await _context.OutboundIssues.AnyAsync(x => !x.IsDeleted && x.BinId == id && x.Status != "Shipped", ct) ||
            await _context.CycleCountSheets.AnyAsync(x => !x.IsDeleted && x.Status != "Completed" && x.Status != "Cancelled" &&
                (x.BinId == id || x.Items.Any(i => i.BinId == id)), ct))
            return true;

        return await _context.OutboundAllocations.AnyAsync(x => x.IsActive && (x.SourceBinId == id || x.StagingBinId == id), ct) ||
            await _context.InventoryReservations.AnyAsync(x =>
                (x.SourceBinInventory.BinId == id || x.StagingBinInventory != null && x.StagingBinInventory.BinId == id) &&
                (x.Status != "Shipped" && x.Status != "Released" || (long)x.Quantity > (long)x.ShippedQuantity + x.ReleasedQuantity), ct) ||
            await _context.PickTasks.AnyAsync(x => (x.SourceBinId == id || x.StagingBinId == id) &&
                x.Status != "Completed" && x.Status != "Released", ct) ||
            await _context.WavePickTasks.AnyAsync(x => x.IsActive &&
                (x.PickTask.SourceBinId == id || x.PickTask.StagingBinId == id), ct);
    }
}
