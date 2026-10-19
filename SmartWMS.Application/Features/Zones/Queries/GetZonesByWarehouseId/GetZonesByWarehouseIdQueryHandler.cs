using MediatR;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Zones.DTOs;
using SmartWMS.Application.Features.Zones.Specifications.Queries;
using SmartWMS.Domain.Entities;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Zones.Queries.GetZonesByWarehouseId;

public sealed class GetZonesByWarehouseIdQueryHandler : IRequestHandler<GetZonesByWarehouseIdQuery, Result<List<ZoneDto>>>
{
    private readonly IUnitOfWork _unitOfWork;
    public GetZonesByWarehouseIdQueryHandler(IUnitOfWork unitOfWork) => _unitOfWork = unitOfWork;

    public async Task<Result<List<ZoneDto>>> Handle(GetZonesByWarehouseIdQuery request, CancellationToken cancellationToken)
    {
        var spec = new ZoneByWarehouseIdSpec(request.RequestData.WarehouseId);
        var data = await _unitOfWork.Repository<Zone>().ListAsync(spec, cancellationToken);

        var result = data.Select(z => new ZoneDto { Id = z.Id, Code = z.Code, Name = z.Name, WarehouseId = z.WarehouseId }).ToList();
        return Result<List<ZoneDto>>.Success(result);
    }
}