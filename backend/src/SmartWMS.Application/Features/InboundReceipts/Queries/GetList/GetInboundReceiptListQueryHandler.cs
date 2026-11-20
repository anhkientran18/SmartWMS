using MediatR;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InboundReceipts.DTOs;
using SmartWMS.Application.Features.InboundReceipts.Specifications.Queries;
using SmartWMS.Domain.Entities;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.InboundReceipts.Queries.GetList;

public sealed class GetInboundReceiptListQueryHandler : IRequestHandler<GetInboundReceiptListQuery, Result<List<InboundReceiptDto>>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetInboundReceiptListQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<List<InboundReceiptDto>>> Handle(GetInboundReceiptListQuery request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<InboundReceipt>();
        var req = request.RequestData;

        var spec = new InboundReceiptListSpec(req.SupplierId, req.Status, req.SearchKeyword);
        var receipts = await repo.ListAsync(spec, cancellationToken);

        var dtos = receipts.Select(r => new InboundReceiptDto
        {
            Id = r.Id,
            ReceiptNumber = r.ReceiptNumber,
            SupplierId = r.SupplierId,
            SupplierName = r.Supplier?.Name ?? string.Empty,
            Status = r.Status,
            ExpectedDeliveryDate = r.ExpectedDeliveryDate,
            ReferenceDocument = r.ReferenceDocument,
            Notes = r.Notes,
            CreatedAt = r.CreatedAt,
            CreatedBy = r.CreatedBy
        }).ToList();

        return Result<List<InboundReceiptDto>>.Success(dtos);
    }
}