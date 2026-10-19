using MediatR;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.OutboundOrders.Specifications.Commands;
using SmartWMS.Domain.Entities;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.DeleteOutboundOrder;

public sealed class DeleteOutboundOrderCommandHandler : IRequestHandler<DeleteOutboundOrderCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;

    public DeleteOutboundOrderCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<bool>> Handle(DeleteOutboundOrderCommand request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<OutboundIssue>();
        var spec = new OutboundOrderByIdForUpdateSpec(request.RequestData.Id);

        var order = await repo.GetEntityWithSpecAsync(spec, cancellationToken);

        if (order == null)
            return Result<bool>.Failure(ErrorCodeConstants.ValidationError, "Đơn xuất kho không tồn tại hoặc đã bị xóa.");

        if (order.Status != "Pending" && order.Status != "Draft" && order.Status != "New")
            return Result<bool>.Failure(ErrorCodeConstants.ValidationError, $"Không thể xóa/hủy đơn xuất kho đang ở trạng thái '{order.Status}'.");

        order.IsDeleted = true;
        order.Status = "Cancelled";

        repo.Update(order);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, "Đã hủy/xóa đơn xuất kho thành công.");
    }
}