using MediatR;
using SmartWMS.Application.Common.Constants;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.OutboundOrders.Specifications.Commands;
using SmartWMS.Domain.Entities;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.UpdateOutboundOrder;

public sealed class UpdateOutboundOrderCommandHandler : IRequestHandler<UpdateOutboundOrderCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IApplicationDbContext _context;

    public UpdateOutboundOrderCommandHandler(IUnitOfWork unitOfWork, IApplicationDbContext context)
    {
        _unitOfWork = unitOfWork;
        _context = context;
    }

    public async Task<Result<bool>> Handle(UpdateOutboundOrderCommand request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<OutboundIssue>();
        var req = request.RequestData;

        var spec = new OutboundOrderByIdForUpdateSpec(req.Id);
        var order = await repo.GetEntityWithSpecAsync(spec, cancellationToken);

        if (order == null)
            return Result<bool>.Failure(ErrorCodeConstants.ValidationError, "Không tìm thấy đơn xuất kho cần chỉnh sửa.");

        // Ràng buộc nghiệp vụ: Chỉ cho phép chỉnh sửa khi đơn chưa chuyển sang phân bổ/nhặt hàng
        if (order.Status != "Pending" && order.Status != "Draft" && order.Status != "New")
            return Result<bool>.Failure(ErrorCodeConstants.ValidationError, $"Không thể chỉnh sửa đơn xuất kho đang ở trạng thái '{order.Status}'.");

        var oldItems = order.Items.ToList();
        var oldItemIds = oldItems.Select(x => x.Id).ToList();
        if (oldItems.Any(x => x.ReservedQuantity != 0 || x.PickedQuantity != 0 ||
                              x.StagedQuantity != 0 || x.ShippedQuantity != 0))
            return Result<bool>.Failure(ErrorCodeConstants.Conflict, "Không thể thay thế dòng đơn hàng đã có tiến độ xử lý.");

        if (oldItemIds.Count > 0 &&
            (await _context.InventoryReservations.AnyAsync(x => oldItemIds.Contains(x.OrderItemId), cancellationToken) ||
             await _context.OutboundPickRequests.AnyAsync(x => x.OrderItemId.HasValue && oldItemIds.Contains(x.OrderItemId.Value), cancellationToken) ||
             await _context.ShipmentItems.AnyAsync(x => oldItemIds.Contains(x.OrderItemId), cancellationToken) ||
             await _context.InventoryTransactions.AnyAsync(x => x.OutboundOrderItemId.HasValue && oldItemIds.Contains(x.OutboundOrderItemId.Value), cancellationToken)))
            return Result<bool>.Failure(ErrorCodeConstants.Conflict, "Không thể thay thế dòng đơn hàng đã có tham chiếu workflow hoặc lịch sử.");

        order.CustomerId = req.CustomerId;
        order.ExpectedShipDate = req.ExpectedShipDate;
        order.Priority = string.IsNullOrWhiteSpace(req.Priority) ? "Normal" : req.Priority;
        order.Notes = req.Notes ?? string.Empty;

        // Replace all lines explicitly; Restrict FKs preserve referenced history under races.
        var itemRepo = _unitOfWork.Repository<OutboundOrderItem>();
        foreach (var oldItem in oldItems)
            itemRepo.Delete(oldItem);
        order.Items.Clear();
        foreach (var item in req.Items)
        {
            var newItem = new OutboundOrderItem
            {
                Id = Guid.NewGuid(),
                OrderId = order.Id,
                ProductId = item.ProductId,
                Quantity = item.RequestedQuantity,
                Status = "Pending"
            };
            order.Items.Add(newItem);
            await itemRepo.AddAsync(newItem, cancellationToken);
        }

        // The header is already tracked; replacement lines are explicitly Added above.
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, "Cập nhật thông tin đơn xuất kho thành công.");
    }
}
