using MediatR;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.CycleCounting.DTOs.Queries;
using SmartWMS.Application.Features.CycleCounting.Specifications.Queries;
using SmartWMS.Domain.Entities;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.CycleCounting.Queries.GetCountSheetById;

public sealed class GetCountSheetByIdQueryHandler : IRequestHandler<GetCountSheetByIdQuery, Result<CycleCountSheetDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetCountSheetByIdQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<CycleCountSheetDto>> Handle(GetCountSheetByIdQuery request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<CycleCountSheet>();
        var spec = new CountSheetByIdSpec(request.RequestData.Id);

        var sheet = await repo.GetEntityWithSpecAsync(spec, cancellationToken);
        if (sheet == null)
            return Result<CycleCountSheetDto>.Failure(ErrorCodeConstants.ValidationError, "Không tìm thấy phiếu kiểm kê yêu cầu.");

        var dto = new CycleCountSheetDto
        {
            Id = sheet.Id,
            BatchCode = sheet.BatchCode,
            SheetNumber = sheet.SheetNumber,
            ZoneId = sheet.ZoneId,
            ZoneName = sheet.Zone?.Name ?? "N/A",
            BinId = sheet.BinId,
            BinCode = sheet.Bin?.Code ?? "N/A",
            Status = sheet.Status,
            AssignedUserId = sheet.AssignedUserId,
            Notes = sheet.Notes,
            CreatedAt = sheet.CreatedAt,
            CreatedBy = sheet.CreatedBy,
            Items = sheet.Items.Select(i => new CycleCountSheetItemDto
            {
                Id = i.Id,
                BinId = i.BinId,
                BinCode = i.Bin?.Code ?? string.Empty,
                LotNumber = i.LotNumber,
                Status = i.Status,
                ProductId = i.ProductId,
                ProductName = i.Product?.Name ?? "N/A",
                SKU = i.Product?.SKU ?? "N/A",
                SystemQuantity = i.SystemQuantity,
                CountedQuantity = i.Status == "Pending" ? null : i.CountedQuantity,
                Variance = i.Status == "Pending" ? null : i.Variance
            }).ToList()
        };

        return Result<CycleCountSheetDto>.Success(dto);
    }
}