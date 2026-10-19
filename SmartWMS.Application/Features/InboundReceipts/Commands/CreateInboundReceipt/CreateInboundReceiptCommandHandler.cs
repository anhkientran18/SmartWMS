using MediatR;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Features.Bins.Specifications.Queries;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InboundReceipts.Specifications.Commands;
using SmartWMS.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.InboundReceipts.Commands.CreateInboundReceipt;

public sealed class CreateInboundReceiptCommandHandler : IRequestHandler<CreateInboundReceiptCommand, Result<Guid>>
{
    private readonly IUnitOfWork _unitOfWork;

    public CreateInboundReceiptCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<Guid>> Handle(CreateInboundReceiptCommand request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<InboundReceipt>();
        var reqData = request.RequestData;

        if (reqData.BinId == Guid.Empty || await _unitOfWork.Repository<Bin>()
            .GetEntityWithSpecAsync(new ActiveBinByIdSpec(reqData.BinId), cancellationToken) == null)
            return Result<Guid>.Failure(ErrorCodeConstants.ValidationError, "Ô kệ đích không tồn tại hoặc không còn hoạt động.");

        // 1. Kiểm tra chống trùng lặp Số phiếu nhập (Double Entry Prevention)
        var spec = new InboundReceiptByNumberSpec(reqData.ReceiptNumber);
        if (await repo.AnyAsync(spec, cancellationToken))
        {
            return Result<Guid>.Failure(ErrorCodeConstants.ValidationError, $"Phiếu nhập kho với số chứng từ '{reqData.ReceiptNumber}' đã tồn tại trong hệ thống.");
        }

        // 2. Khởi tạo Header (Thông tin chung của phiếu nhập)
        var inboundReceipt = new InboundReceipt
        {
            Id = Guid.NewGuid(),
            ReceiptNumber = reqData.ReceiptNumber,
            SupplierId = reqData.SupplierId,
            BinId = reqData.BinId,
            ExpectedDeliveryDate = reqData.ExpectedDeliveryDate,
            ReferenceDocument = reqData.ReferenceDocument,
            Notes = reqData.Notes,
            Status = "New",
            CreatedAt = DateTime.UtcNow
        };

        // 3. Khởi tạo Line Items (Chi tiết mặt hàng theo đúng tên property của bạn)
        inboundReceipt.Items = new List<InboundReceiptItem>();

        foreach (var itemReq in reqData.Items)
        {
            inboundReceipt.Items.Add(new InboundReceiptItem
            {
                Id = Guid.NewGuid(),
                InboundReceiptId = inboundReceipt.Id,
                ProductId = itemReq.ProductId,
                QuantityExpected = itemReq.ExpectedQuantity, // Khớp với property QuantityExpected trong Entity
                QuantityReceived = 0,                        // Mới tạo phiếu thì thực nhận bằng 0, chờ nhân viên kho quét thực tế
                LotNumber = string.IsNullOrWhiteSpace(itemReq.LotNumber) ? "N/A" : itemReq.LotNumber,
                ExpirationDate = itemReq.ExpirationDate
            });
        }

        // 4. Lưu toàn bộ xuống Database trong 1 Transaction duy nhất qua UnitOfWork
        await repo.AddAsync(inboundReceipt, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<Guid>.Success(inboundReceipt.Id, $"Khởi tạo thành công Phiếu nhập kho: {inboundReceipt.ReceiptNumber}.");
    }
}