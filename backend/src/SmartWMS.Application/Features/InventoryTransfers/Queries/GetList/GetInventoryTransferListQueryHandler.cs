using MediatR;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InventoryTransfers.DTOs.Queries;
using SmartWMS.Application.Features.InventoryTransfers.Specifications.Queries;
using SmartWMS.Domain.Entities;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.InventoryTransfers.Queries.GetList;

public sealed class GetInventoryTransferListQueryHandler : IRequestHandler<GetInventoryTransferListQuery, Result<List<InventoryTransferDto>>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetInventoryTransferListQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<List<InventoryTransferDto>>> Handle(GetInventoryTransferListQuery request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<InventoryTransaction>();
        var req = request.RequestData;

        var spec = new InventoryTransferListSpec(req.ProductId, req.SearchKeyword);
        var items = await repo.ListAsync(spec, cancellationToken);

        var dtos = items.Select(x => new InventoryTransferDto
        {
            Id = x.Id,
            ProductId = x.ProductId,
            ProductName = x.Product?.Name ?? "N/A",
            SKU = x.Product?.SKU ?? "N/A",
            QuantityTransferred = x.QuantityChanged,
            SourceBinCode = x.SourceBinCode,
            DestinationBinCode = x.DestinationBinCode,
            ReasonCode = x.ReasonCode,
            TransferredAt = x.CreatedAt,
            TransferredBy = x.CreatedBy
        }).ToList();

        return Result<List<InventoryTransferDto>>.Success(dtos);
    }
}