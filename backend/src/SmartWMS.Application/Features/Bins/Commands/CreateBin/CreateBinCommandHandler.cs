using MediatR;
using SmartWMS.Application.Common.Constants;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Bins.Specifications.Commands;
using SmartWMS.Domain.Entities;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Bins.Commands.CreateBin;

public sealed class CreateBinCommandHandler : IRequestHandler<CreateBinCommand, Result<Guid>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IApplicationDbContext _context;
    private readonly IInventoryMutationCoordinator _mutations;

    public CreateBinCommandHandler(IUnitOfWork unitOfWork, IApplicationDbContext context,
        IInventoryMutationCoordinator mutations)
    {
        _unitOfWork = unitOfWork;
        _context = context;
        _mutations = mutations;
    }

    public async Task<Result<Guid>> Handle(CreateBinCommand request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<Bin>();
        var reqData = request.RequestData;
        await using var tx = await _mutations.BeginAsync(cancellationToken);
        if (!await _context.Zones.AnyAsync(x => x.Id == reqData.ZoneId && !x.IsDeleted &&
            x.Warehouse != null && !x.Warehouse.IsDeleted, cancellationToken))
            return Result<Guid>.Failure(ErrorCodeConstants.ValidationError, "Hierarchy Zone/Warehouse không tồn tại hoặc đã bị xóa.");

        // Kiểm tra mã Code đã tồn tại trong Zone chưa
        var spec = new BinByCodeAndZoneForCreateSpec(reqData.Code, reqData.ZoneId);
        if (await repo.AnyAsync(spec, cancellationToken))
        {
            return Result<Guid>.Failure(ErrorCodeConstants.ValidationError, $"Mã vị trí kệ '{reqData.Code}' đã tồn tại trong khu vực này.");
        }

        var bin = new Bin
        {
            Id = Guid.NewGuid(),
            Purpose = reqData.Purpose,
            Code = reqData.Code,
            ZoneId = reqData.ZoneId,
            MaxCapacity = reqData.MaxCapacity,
            CurrentOccupancy = 0.0,
            IsDeleted = false
        };

        await repo.AddAsync(bin, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        return Result<Guid>.Success(bin.Id, $"Khởi tạo thành công ô kệ vị trí {bin.Code} trên sơ đồ.");
    }
}
