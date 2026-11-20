using MediatR;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InventoryTransfers.DTOs.Queries;
using SmartWMS.Application.Features.InventoryTransfers.Specifications.Queries;
using SmartWMS.Domain.Entities;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.InventoryTransfers.Queries.GetPaginatedInventoryTransfers;

public sealed class GetPaginatedInventoryTransfersQueryHandler
    : IRequestHandler<GetPaginatedInventoryTransfersQuery, Result<PaginatedResult<InventoryTransferDto>>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetPaginatedInventoryTransfersQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<PaginatedResult<InventoryTransferDto>>> Handle(GetPaginatedInventoryTransfersQuery request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<InventoryTransaction>();
        var req = request.RequestData;

        var listSpec = new InventoryTransferPaginatedSpec(req.ProductId, req.SearchKeyword, req.PageIndex, req.PageSize);
        var countSpec = new InventoryTransferCountSpec(req.ProductId, req.SearchKeyword);

        var items = await repo.ListAsync(listSpec, cancellationToken);
        var totalCount = await repo.CountAsync(countSpec, cancellationToken);

        var dtoItems = items.Select(x => new InventoryTransferDto
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

        var result = PaginatedResult<InventoryTransferDto>.Create(dtoItems, totalCount, req.PageIndex, req.PageSize);
        return Result<PaginatedResult<InventoryTransferDto>>.Success(result);
    }
}