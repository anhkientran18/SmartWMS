using MediatR;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Features.Bins.Specifications.Queries;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InboundReceipts.Specifications.Commands;
using SmartWMS.Domain.Entities;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.InboundReceipts.Commands.UpdateInboundReceipt;

public sealed class UpdateInboundReceiptCommandHandler : IRequestHandler<UpdateInboundReceiptCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;

    public UpdateInboundReceiptCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<bool>> Handle(UpdateInboundReceiptCommand request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<InboundReceipt>();
        var req = request.RequestData;

        var spec = new InboundReceiptByIdForUpdateSpec(req.Id);
        var receipt = await repo.GetEntityWithSpecAsync(spec, cancellationToken);

        if (receipt == null)
            return Result<bool>.Failure(ErrorCodeConstants.ValidationError, "Không tìm thấy phiếu nhập kho cần cập nhật.");

        if (receipt.Status != "Pending" && receipt.Status != "Draft" && receipt.Status != "New")
            return Result<bool>.Failure(ErrorCodeConstants.ValidationError, $"Không thể chỉnh sửa phiếu nhập kho đang ở trạng thái '{receipt.Status}'.");

        if (req.BinId.HasValue)
        {
            if (req.BinId.Value == Guid.Empty || await _unitOfWork.Repository<Bin>()
                .GetEntityWithSpecAsync(new ActiveBinByIdSpec(req.BinId.Value), cancellationToken) == null)
                return Result<bool>.Failure(ErrorCodeConstants.ValidationError, "Ô kệ đích không tồn tại hoặc không còn hoạt động.");

            receipt.BinId = req.BinId.Value;
        }

        receipt.SupplierId = req.SupplierId;
        receipt.ExpectedDeliveryDate = req.ExpectedDeliveryDate;
        receipt.ReferenceDocument = req.ReferenceDocument ?? string.Empty;
        receipt.Notes = req.Notes ?? string.Empty;

        // Cập nhật lại danh sách mặt hàng dùng đúng QuantityExpected & QuantityReceived
        receipt.Items.Clear();
        foreach (var item in req.Items)
        {
            receipt.Items.Add(new InboundReceiptItem
            {
                Id = Guid.NewGuid(),
                InboundReceiptId = receipt.Id,
                ProductId = item.ProductId,
                QuantityExpected = item.ExpectedQuantity,
                QuantityReceived = 0
            });
        }

        repo.Update(receipt);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, "Cập nhật phiếu nhập kho thành công.");
    }
}