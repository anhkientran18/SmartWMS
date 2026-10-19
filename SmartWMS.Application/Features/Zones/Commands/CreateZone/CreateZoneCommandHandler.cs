using MediatR;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Zones.Specifications.Commands;
using SmartWMS.Domain.Entities;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Zones.Commands.CreateZone;

public sealed class CreateZoneCommandHandler : IRequestHandler<CreateZoneCommand, Result<Guid>>
{
    private readonly IUnitOfWork _unitOfWork;

    public CreateZoneCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<Guid>> Handle(CreateZoneCommand request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<Zone>();
        var reqData = request.RequestData;

        var spec = new ZoneByCodeForCreateSpec(reqData.Code, reqData.WarehouseId);
        if (await repo.AnyAsync(spec, cancellationToken))
        {
            return Result<Guid>.Failure(ErrorCodeConstants.ValidationError, $"Mã khu vực '{reqData.Code}' đã tồn tại trong kho này.");
        }

        var zone = new Zone
        {
            Id = Guid.NewGuid(),
            Code = reqData.Code, // Đảm bảo thực thể Zone của bạn có property Code nhé
            Name = reqData.Name,
            WarehouseId = reqData.WarehouseId
        };

        await repo.AddAsync(zone, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<Guid>.Success(zone.Id, $"Khởi tạo thành công khu vực {zone.Name}.");
    }
}