using MediatR;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Bins.DTOs;
using SmartWMS.Application.Features.Bins.Specifications.Queries;
using SmartWMS.Domain.Entities;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Bins.Queries.GetList;

public sealed class GetBinListQueryHandler : IRequestHandler<GetBinListQuery, Result<List<BinDto>>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetBinListQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<List<BinDto>>> Handle(GetBinListQuery request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<Bin>();
        var spec = new BinListSpec(request.RequestData.ZoneId, request.RequestData.SearchKeyword);

        var bins = await repo.ListAsync(spec, cancellationToken);

        var dtos = bins.Select(b => new BinDto
        {
            Purpose = b.Purpose,
            Id = b.Id,
            Code = b.Code,
            ZoneId = b.ZoneId,
            MaxCapacity = b.MaxCapacity,
            CurrentOccupancy = b.CurrentOccupancy
        }).ToList();

        return Result<List<BinDto>>.Success(dtos);
    }
}