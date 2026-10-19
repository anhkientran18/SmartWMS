using MediatR;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InboundReceipts.DTOs;
using SmartWMS.Application.Features.InboundReceipts.Specifications.Queries;
using SmartWMS.Domain.Entities;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.InboundReceipts.Queries.GetPaginatedInboundReceipts;

public sealed class GetPaginatedInboundReceiptsQueryHandler : IRequestHandler<GetPaginatedInboundReceiptsQuery, Result<PaginatedResult<InboundReceiptDto>>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetPaginatedInboundReceiptsQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<PaginatedResult<InboundReceiptDto>>> Handle(GetPaginatedInboundReceiptsQuery request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<InboundReceipt>();
        var reqData = request.RequestData;

        var listSpec = new InboundReceiptPaginatedSpec(reqData.SearchKeyword, reqData.PageIndex, reqData.PageSize);
        var countSpec = new InboundReceiptCountSpec(reqData.SearchKeyword);

        var items = await repo.ListAsync(listSpec, cancellationToken);
        var totalCount = await repo.CountAsync(countSpec, cancellationToken);

        var dtoItems = items.Select(x => new InboundReceiptDto
        {
            Id = x.Id,
            ReceiptNumber = x.ReceiptNumber,
            Status = x.Status,
            ExpectedDeliveryDate = x.ExpectedDeliveryDate,
            ReferenceDocument = x.ReferenceDocument,
            Notes = x.Notes,
            SupplierId = x.SupplierId,
            SupplierName = x.Supplier?.Name ?? "N/A",
            BinId = x.BinId,
            CreatedAt = x.CreatedAt,
            CreatedBy = x.CreatedBy
            // Lưu ý: Phân trang danh sách thường không cần Include Items con để nhẹ API, nếu cần thì join thêm.
        }).ToList();

        var result = PaginatedResult<InboundReceiptDto>.Create(dtoItems, totalCount, reqData.PageIndex, reqData.PageSize);

        return Result<PaginatedResult<InboundReceiptDto>>.Success(result);
    }
}