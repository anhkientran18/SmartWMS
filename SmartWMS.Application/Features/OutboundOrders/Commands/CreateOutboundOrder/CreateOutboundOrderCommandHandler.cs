using MediatR;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Features.Bins.Specifications.Queries;
using SmartWMS.Application.Features.OutboundOrders.Specifications.Commands;
using SmartWMS.Application.Common.Models;
using SmartWMS.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.CreateOutboundOrder;

public sealed class CreateOutboundOrderCommandHandler : IRequestHandler<CreateOutboundOrderCommand, Result<Guid>>
{
    private readonly IUnitOfWork _unitOfWork;

    public CreateOutboundOrderCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<Guid>> Handle(CreateOutboundOrderCommand request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<OutboundIssue>(); // Tạm dùng OutboundIssue
        var req = request.RequestData;

        if (req.BinId == Guid.Empty || await _unitOfWork.Repository<Bin>()
            .GetEntityWithSpecAsync(new ActiveBinByIdSpec(req.BinId), cancellationToken) == null)
            return Result<Guid>.Failure(ErrorCodeConstants.ValidationError, "Ô kệ xuất hàng không tồn tại hoặc không còn hoạt động.");

        if (await repo.AnyAsync(new OutboundOrderByNumberSpec(req.OrderNumber), cancellationToken))
            return Result<Guid>.Failure(ErrorCodeConstants.ValidationError, "Mã đơn hàng xuất đã tồn tại.");

        // Khởi tạo Header phiếu xuất
        var outboundOrder = new OutboundIssue
        {
            Id = Guid.NewGuid(),
            CustomerId = req.CustomerId,
            BinId = req.BinId,
            OrderNumber = req.OrderNumber,
            ExpectedShipDate = req.ExpectedShipDate,
            Priority = req.Priority,
            Notes = req.Notes,
            CreatedAt = DateTime.UtcNow,
        };

        // Khởi tạo Line Items
        outboundOrder.Items = new List<OutboundOrderItem>();
        foreach (var item in req.Items)
        {
            outboundOrder.Items.Add(new OutboundOrderItem
            {
                Id = Guid.NewGuid(),
                OrderId = outboundOrder.Id,
                ProductId = item.ProductId,
                Quantity = item.RequestedQuantity,
                Status = "Pending" // Chờ xử lý Picking
            });
        }

        await repo.AddAsync(outboundOrder, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<Guid>.Success(outboundOrder.Id, "Tạo phiếu xuất kho thành công.");
    }
}