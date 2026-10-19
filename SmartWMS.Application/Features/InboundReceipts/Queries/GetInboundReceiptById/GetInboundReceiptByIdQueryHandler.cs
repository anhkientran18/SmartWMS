using MediatR;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InboundReceipts.DTOs;
using SmartWMS.Application.Features.InboundReceipts.Specifications.Queries;
using SmartWMS.Domain.Entities;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.InboundReceipts.Queries.GetInboundReceiptById;

public sealed class GetInboundReceiptByIdQueryHandler : IRequestHandler<GetInboundReceiptByIdQuery, Result<InboundReceiptDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    public GetInboundReceiptByIdQueryHandler(IUnitOfWork unitOfWork) => _unitOfWork = unitOfWork;

    public async Task<Result<InboundReceiptDto>> Handle(GetInboundReceiptByIdQuery request, CancellationToken cancellationToken)
    {
        var spec = new InboundReceiptByIdSpec(request.RequestData.Id);
        var receipt = await _unitOfWork.Repository<InboundReceipt>().GetEntityWithSpecAsync(spec, cancellationToken);

        if (receipt == null)
            return Result<InboundReceiptDto>.Failure(ErrorCodeConstants.ValidationError, "Không tìm thấy phiếu nhập.");

        // Mapping (Chuyển đổi Entity sang DTO để trả về cho Frontend)
        var dto = new InboundReceiptDto
        {
            Id = receipt.Id,
            ReceiptNumber = receipt.ReceiptNumber,
            Status = receipt.Status,
            ExpectedDeliveryDate = receipt.ExpectedDeliveryDate,
            ReferenceDocument = receipt.ReferenceDocument,
            Notes = receipt.Notes,
            SupplierId = receipt.SupplierId,
            SupplierName = receipt.Supplier?.Name ?? "N/A", // Lấy tên NCC nhờ Include

            Items = receipt.Items.Select(i => new InboundReceiptItemDto
            {
                Id = i.Id,
                ProductId = i.ProductId,
                ProductName = i.Product?.Name ?? "N/A", // Lấy tên sản phẩm nhờ Include
                QuantityExpected = i.QuantityExpected,
                QuantityReceived = i.QuantityReceived,
                LotNumber = i.LotNumber,
                ExpirationDate = i.ExpirationDate
            }).ToList()
        };

        return Result<InboundReceiptDto>.Success(dto);
    }
}