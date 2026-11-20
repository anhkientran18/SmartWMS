using MediatR;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InventoryTransfers.DTOs.Queries;
using SmartWMS.Application.Features.InventoryTransfers.Specifications.Queries;
using SmartWMS.Domain.Entities;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.InventoryTransfers.Queries.GetById;

public sealed class GetInventoryTransferByIdQueryHandler : IRequestHandler<GetInventoryTransferByIdQuery, Result<InventoryTransferDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetInventoryTransferByIdQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<InventoryTransferDto>> Handle(GetInventoryTransferByIdQuery request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<InventoryTransaction>();
        var spec = new InventoryTransferByIdSpec(request.RequestData.Id);

        var transaction = await repo.GetEntityWithSpecAsync(spec, cancellationToken);
        if (transaction == null)
            return Result<InventoryTransferDto>.Failure(ErrorCodeConstants.ValidationError, "Không tìm thấy chi tiết giao dịch luân chuyển.");

        var dto = new InventoryTransferDto
        {
            Id = transaction.Id,
            ProductId = transaction.ProductId,
            ProductName = transaction.Product?.Name ?? "N/A",
            SKU = transaction.Product?.SKU ?? "N/A",
            QuantityTransferred = transaction.QuantityChanged,
            SourceBinCode = transaction.SourceBinCode,
            DestinationBinCode = transaction.DestinationBinCode,
            ReasonCode = transaction.ReasonCode,
            TransferredAt = transaction.CreatedAt,
            TransferredBy = transaction.CreatedBy
        };

        return Result<InventoryTransferDto>.Success(dto);
    }
}