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
using Microsoft.EntityFrameworkCore;
using SmartWMS.Domain.Enums;

public sealed class CreateOutboundOrderCommandHandler : IRequestHandler<CreateOutboundOrderCommand, Result<Guid>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IApplicationDbContext _context;

    public CreateOutboundOrderCommandHandler(IUnitOfWork unitOfWork, IApplicationDbContext context)
    {
        _unitOfWork = unitOfWork;
        _context = context;
    }

    public async Task<Result<Guid>> Handle(CreateOutboundOrderCommand request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<OutboundIssue>(); // Tạm dùng OutboundIssue
        var req = request.RequestData;
        if (req == null || string.IsNullOrWhiteSpace(req.OrderNumber) || req.OrderNumber.Length > 50 || req.Items == null ||
            req.Items.Count == 0 || req.Items.Any(x => x == null || x.ProductId == Guid.Empty || x.RequestedQuantity <= 0))
            return Result<Guid>.Failure(ErrorCodeConstants.ValidationError, "Order number/items/quantity không hợp lệ.");
        var ids = req.Items.Select(x => x.ProductId).Distinct().ToList();
        if (await _context.Products.CountAsync(x => ids.Contains(x.Id) && !x.IsDeleted &&
            (x.TrackingMode == ProductTrackingMode.None || x.TrackingMode == ProductTrackingMode.Lot), cancellationToken) != ids.Count ||
            (req.CustomerId.HasValue && !await _context.Customers.AnyAsync(x => x.Id == req.CustomerId && !x.IsDeleted, cancellationToken)))
            return Result<Guid>.Failure(ErrorCodeConstants.ValidationError, "B3 create chỉ hỗ trợ product active None/Lot và customer active nếu có.");

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
                IsDirectPick = true,
                Status = "Pending" // Chờ xử lý Picking
            });
        }

        await repo.AddAsync(outboundOrder, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<Guid>.Success(outboundOrder.Id, "Tạo phiếu xuất kho thành công.");
    }
}
