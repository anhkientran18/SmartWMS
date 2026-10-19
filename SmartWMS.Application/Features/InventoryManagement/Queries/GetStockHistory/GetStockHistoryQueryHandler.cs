using MediatR;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InventoryManagement.DTOs.Queries;
using SmartWMS.Application.Features.InventoryManagement.Specifications.Queries;
using SmartWMS.Domain.Entities;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.InventoryManagement.Queries.GetStockHistory;

public class GetStockHistoryQueryHandler : IRequestHandler<GetStockHistoryQuery, Result<PaginatedResult<StockHistoryDto>>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetStockHistoryQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<PaginatedResult<StockHistoryDto>>> Handle(GetStockHistoryQuery request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<InventoryTransaction>();
        var req = request.RequestData;

        var listSpec = new StockHistoryPaginatedSpec(req.ProductId, req.TransactionType, req.PageIndex, req.PageSize);
        var countSpec = new StockHistoryCountSpec(req.ProductId, req.TransactionType);

        var items = await repo.ListAsync(listSpec, cancellationToken);
        var totalCount = await repo.CountAsync(countSpec, cancellationToken);

        var dtoItems = items.Select(x => new StockHistoryDto
        {
            Id = x.Id,
            ProductId = x.ProductId,
            ProductName = x.Product?.Name ?? "UNKNOWN",
            TransactionType = x.TransactionType,
            QuantityChanged = x.QuantityChanged,
            SourceBinCode = x.SourceBinCode,
            DestinationBinCode = x.DestinationBinCode,
            ReasonCode = x.ReasonCode,
            CreatedAt = x.CreatedAt,
            CreatedBy = x.CreatedBy
        }).ToList();

        var result = PaginatedResult<StockHistoryDto>.Create(dtoItems, totalCount, req.PageIndex, req.PageSize);

        return Result<PaginatedResult<StockHistoryDto>>.Success(result);
    }
}