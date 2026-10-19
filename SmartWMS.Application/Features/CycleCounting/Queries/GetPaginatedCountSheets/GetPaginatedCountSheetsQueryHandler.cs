using MediatR;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.CycleCounting.DTOs.Queries;
using SmartWMS.Application.Features.CycleCounting.Specifications.Queries;
using SmartWMS.Domain.Entities;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.CycleCounting.Queries.GetPaginatedCountSheets;

public sealed class GetPaginatedCountSheetsQueryHandler : IRequestHandler<GetPaginatedCountSheetsQuery, Result<PaginatedResult<CycleCountSheetDto>>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetPaginatedCountSheetsQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<PaginatedResult<CycleCountSheetDto>>> Handle(GetPaginatedCountSheetsQuery request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<CycleCountSheet>();
        var req = request.RequestData;

        var listSpec = new CountSheetPaginatedSpec(req.Status, req.SearchKeyword, req.PageIndex, req.PageSize);
        var countSpec = new CountSheetCountSpec(req.Status, req.SearchKeyword);

        var items = await repo.ListAsync(listSpec, cancellationToken);
        var totalCount = await repo.CountAsync(countSpec, cancellationToken);

        var dtoItems = items.Select(sheet => new CycleCountSheetDto
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

        var result = PaginatedResult<CycleCountSheetDto>.Create(dtoItems, totalCount, req.PageIndex, req.PageSize);
        return Result<PaginatedResult<CycleCountSheetDto>>.Success(result);
    }
}