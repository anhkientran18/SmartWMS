using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Transactions;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Warehouses.Specifications.Commands;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Warehouses.Commands.UpdateWarehouse;

public sealed class UpdateWarehouseCommandHandler : IRequestHandler<UpdateWarehouseCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IApplicationDbContext _context;

    public UpdateWarehouseCommandHandler(IUnitOfWork unitOfWork, IApplicationDbContext context)
    {
        _unitOfWork = unitOfWork;
        _context = context;
    }

    public async Task<Result<bool>> Handle(UpdateWarehouseCommand request, CancellationToken cancellationToken)
    {
        using var transaction = new TransactionScope(TransactionScopeOption.Required,
            new TransactionOptions { IsolationLevel = IsolationLevel.Serializable },
            TransactionScopeAsyncFlowOption.Enabled);
        var repo = _unitOfWork.Repository<Warehouse>();
        var reqData = request.RequestData;

        var warehouse = await _context.Warehouses.AsTracking()
            .FirstOrDefaultAsync(x => x.Id == reqData.Id && !x.IsDeleted, cancellationToken);

        if (warehouse == null)
            return Result<bool>.Failure(ErrorCodeConstants.ValidationError, "Không tìm thấy cơ sở kho yêu cầu.");

        var codeSpec = new WarehouseByCodeForUpdateSpec(reqData.Id, reqData.Code);
        if (await repo.AnyAsync(codeSpec, cancellationToken))
            return Result<bool>.Failure(ErrorCodeConstants.ValidationError, "Mã kho này đã được sử dụng cho một cơ sở khác.");

        if (reqData.DefaultStagingBinIdSpecified)
        {
            if (reqData.DefaultStagingBinId.HasValue)
            {
                var bin = await _context.Bins.Include(x => x.Zone).ThenInclude(x => x!.Warehouse)
                    .AsNoTracking().FirstOrDefaultAsync(x => x.Id == reqData.DefaultStagingBinId.Value, cancellationToken);
                if (bin == null)
                    return Result<bool>.Failure(ErrorCodeConstants.NotFound, "Không tìm thấy ô kệ staging.");
                if (bin.IsDeleted || bin.Purpose != BinPurpose.Staging || bin.Zone == null || bin.Zone.IsDeleted ||
                    bin.Zone.WarehouseId != warehouse.Id || bin.Zone.Warehouse == null || bin.Zone.Warehouse.IsDeleted)
                    return Result<bool>.Failure(ErrorCodeConstants.Conflict,
                        "Ô kệ staging phải thuộc đúng kho, có Purpose=Staging và toàn bộ hierarchy còn hoạt động.");
            }

            // Existing workflows retain their persisted staging identity when the default is cleared.
            warehouse.DefaultStagingBinId = reqData.DefaultStagingBinId;
        }

        warehouse.Code = reqData.Code;
        warehouse.Name = reqData.Name;
        warehouse.Address = reqData.Address;

        repo.Update(warehouse);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        transaction.Complete();

        return Result<bool>.Success(true, "Cập nhật thành công thông tin kho.");
    }
}
