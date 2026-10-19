using MediatR;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.CycleCounting.DTOs.Queries;
using SmartWMS.Application.Features.CycleCounting.Specifications.Queries;
using SmartWMS.Domain.Entities;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.CycleCounting.Queries.GetList;

public sealed class GetCountSheetListQueryHandler : IRequestHandler<GetCountSheetListQuery, Result<List<CycleCountSheetDto>>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetCountSheetListQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<List<CycleCountSheetDto>>> Handle(GetCountSheetListQuery request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<CycleCountSheet>();
        var req = request.RequestData;

        var spec = new CountSheetListSpec(req.Status, req.SearchKeyword);
        var items = await repo.ListAsync(spec, cancellationToken);

        var dtos = items.Select(sheet => new CycleCountSheetDto
        {
            Id = sheet.Id,
            BatchCode = sheet.BatchCode,
            ZoneId = sheet.ZoneId,
            ZoneName = sheet.Zone?.Name ?? "N/A",
            BinId = sheet.BinId,
            BinCode = sheet.Bin?.Code ?? "N/A",
            Status = sheet.Status,
            AssignedUserId = sheet.AssignedUserId,
            Notes = sheet.Notes,
            CreatedAt = sheet.CreatedAt,
            CreatedBy = sheet.CreatedBy
        }).ToList();

        return Result<List<CycleCountSheetDto>>.Success(dtos);
    }
}