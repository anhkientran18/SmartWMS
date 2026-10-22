using MediatR;
using SmartWMS.Application.Common.Constants;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Zones.Specifications.Commands;
using SmartWMS.Domain.Entities;
using System;
using System.Data.Common;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Zones.Commands.DeleteZone;

public sealed class DeleteZoneCommandHandler : IRequestHandler<DeleteZoneCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IApplicationDbContext _context;
    private readonly IInventoryMutationCoordinator _mutations;

    public DeleteZoneCommandHandler(IUnitOfWork unitOfWork, IApplicationDbContext context,
        IInventoryMutationCoordinator mutations)
    {
        _unitOfWork = unitOfWork;
        _context = context;
        _mutations = mutations;
    }

    public async Task<Result<bool>> Handle(DeleteZoneCommand request, CancellationToken cancellationToken)
    {
        var zoneRepo = _unitOfWork.Repository<Zone>();
        var binRepo = _unitOfWork.Repository<Bin>();
        var reqData = request.RequestData;
        await using var tx = await _mutations.BeginAsync(cancellationToken);

        var zoneSpec = new ZoneByIdForUpdateSpec(reqData.Id);
        var zone = await zoneRepo.GetEntityWithSpecAsync(zoneSpec, cancellationToken);

        if (zone == null)
            return Result<bool>.Failure(ErrorCodeConstants.ZoneNotFound, "Không tìm thấy khu vực yêu cầu tháo dỡ.");

        // Ràng buộc doanh nghiệp: Không cho phép xóa Zone nếu bên trong vẫn còn Bin
        var binCheckSpec = new ZoneBinCheckForDeleteSpec(reqData.Id);
        if (await binRepo.AnyAsync(binCheckSpec, cancellationToken) ||
            await _context.CycleCountSheets.AnyAsync(x => x.ZoneId == zone.Id, cancellationToken))
            return Result<bool>.Failure(ErrorCodeConstants.Conflict,
                $"Không thể tháo dỡ khu vực {zone.Name} vì còn ô kệ hoặc lịch sử kiểm kê tham chiếu, kể cả dữ liệu đã xóa mềm.");

        zoneRepo.Delete(zone);

        try
        {
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (IsDeleteReferenceConflict(ex, zone))
        {
            await tx.RollbackAsync();
            return Result<bool>.Failure(ErrorCodeConstants.Conflict,
                "Khu vực vừa phát sinh tham chiếu đồng thời; không thể xóa. Hãy tải lại.");
        }
        await tx.CommitAsync(cancellationToken);

        return Result<bool>.Success(true, $"Đã tháo dỡ khu vực {zone.Name} thành công.");
    }

    private static bool IsDeleteReferenceConflict(DbUpdateException exception, Zone zone)
    {
        if (!exception.Entries.Any(x => ReferenceEquals(x.Entity, zone) && x.State == EntityState.Deleted))
            return false;
        for (Exception? inner = exception.InnerException; inner != null; inner = inner.InnerException)
        {
            // Keep the SQL provider dependency in Infrastructure; inspect its specific error number only.
            if (inner is DbException sql && sql.GetType().FullName == "Microsoft.Data.SqlClient.SqlException" &&
                sql.GetType().GetProperty("Number")?.GetValue(sql) is 547)
                return true;
        }
        return false;
    }
}
