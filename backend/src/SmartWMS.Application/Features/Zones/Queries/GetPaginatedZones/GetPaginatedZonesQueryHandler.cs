using MediatR;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Zones.DTOs;
using SmartWMS.Application.Features.Zones.Specifications.Queries;
using SmartWMS.Domain.Entities;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Zones.Queries.GetPaginatedZones;

public sealed class GetPaginatedZonesQueryHandler : IRequestHandler<GetPaginatedZonesQuery, Result<PaginatedResult<ZoneDto>>>
{
    private readonly IUnitOfWork _unitOfWork;
    public GetPaginatedZonesQueryHandler(IUnitOfWork unitOfWork) => _unitOfWork = unitOfWork;

    public async Task<Result<PaginatedResult<ZoneDto>>> Handle(GetPaginatedZonesQuery request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<Zone>();
        var req = request.RequestData;

        var listSpec = new ZonePaginatedListSpec(req.SearchKeyword, req.PageIndex, req.PageSize);
        var countSpec = new ZoneCountSpec(req.SearchKeyword);

        var items = await repo.ListAsync(listSpec, cancellationToken);
        var total = await repo.CountAsync(countSpec, cancellationToken);

        var dtoItems = items.Select(z => new ZoneDto { Id = z.Id, Code = z.Code, Name = z.Name, WarehouseId = z.WarehouseId }).ToList();
        var result = PaginatedResult<ZoneDto>.Create(dtoItems, total, req.PageIndex, req.PageSize);

        return Result<PaginatedResult<ZoneDto>>.Success(result);
    }
}