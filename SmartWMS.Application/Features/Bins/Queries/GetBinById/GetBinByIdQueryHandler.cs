using MediatR;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Bins.DTOs;
using SmartWMS.Application.Features.Bins.Specifications.Queries;
using SmartWMS.Domain.Entities;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Bins.Queries.GetBinById;

public class GetBinByIdQueryHandler : IRequestHandler<GetBinByIdQuery, Result<BinDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetBinByIdQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<BinDto>> Handle(GetBinByIdQuery request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<Bin>();
        var spec = new BinByIdSpec(request.RequestData.Id);

        var bin = await repo.GetEntityWithSpecAsync(spec, cancellationToken);

        if (bin == null)
            return Result<BinDto>.Failure(ErrorCodeConstants.BinNotFound, "Thực thể ô kệ không tồn tại trong hệ thống kho.");

        var dto = new BinDto
        {
            Purpose = bin.Purpose,
            Id = bin.Id,
            Code = bin.Code,
            ZoneId = bin.ZoneId,
            MaxCapacity = bin.MaxCapacity,
            CurrentOccupancy = bin.CurrentOccupancy
        };

        return Result<BinDto>.Success(dto);
    }
}