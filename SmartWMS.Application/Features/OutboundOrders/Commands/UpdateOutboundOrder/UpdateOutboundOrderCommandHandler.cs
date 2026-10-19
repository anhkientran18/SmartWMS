using MediatR;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.OutboundOrders.Specifications.Commands;
using SmartWMS.Domain.Entities;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.UpdateOutboundOrder;

public sealed class UpdateOutboundOrderCommandHandler : IRequestHandler<UpdateOutboundOrderCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;

    public UpdateOutboundOrderCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
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

        order.CustomerId = req.CustomerId;
        order.ExpectedShipDate = req.ExpectedShipDate;
        order.Priority = string.IsNullOrWhiteSpace(req.Priority) ? "Normal" : req.Priority;
        order.Notes = req.Notes ?? string.Empty;

        // Re-populate danh sách mặt hàng
        order.Items.Clear();
        foreach (var item in req.Items)
        {
            order.Items.Add(new OutboundOrderItem
            {
                Id = Guid.NewGuid(),
                OrderId = order.Id,
                ProductId = item.ProductId,
                Quantity = item.RequestedQuantity,
                Status = "Pending"
            });
        }

        repo.Update(order);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, "Cập nhật thông tin đơn xuất kho thành công.");
    }
}