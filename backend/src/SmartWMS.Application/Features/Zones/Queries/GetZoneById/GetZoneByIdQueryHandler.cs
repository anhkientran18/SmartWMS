using MediatR;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Zones.DTOs;
using SmartWMS.Application.Features.Zones.Specifications.Queries;
using SmartWMS.Domain.Entities;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Zones.Queries.GetZoneById;

public sealed class GetZoneByIdQueryHandler : IRequestHandler<GetZoneByIdQuery, Result<ZoneDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetZoneByIdQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<ZoneDto>> Handle(GetZoneByIdQuery request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<Zone>();
        var spec = new ZoneByIdSpec(request.RequestData.Id);

        var zone = await repo.GetEntityWithSpecAsync(spec, cancellationToken);
        if (zone == null)
            return Result<ZoneDto>.Failure(ErrorCodeConstants.ValidationError, "Không tìm thấy khu vực (Zone) yêu cầu.");

        var dto = new ZoneDto
        {
            Id = zone.Id,
            Code = zone.Code,
            Name = zone.Name,
            WarehouseId = zone.WarehouseId
        };

        return Result<ZoneDto>.Success(dto);
    }
}