using MediatR;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.OutboundOrders.Specifications.Commands;
using SmartWMS.Domain.Entities;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.CreatePickTask;

public sealed class CreatePickTaskCommandHandler : IRequestHandler<CreatePickTaskCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;

    public CreatePickTaskCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<bool>> Handle(CreatePickTaskCommand request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<OutboundIssue>();
        var spec = new OutboundOrderWithItemsForAllocateSpec(request.RequestData.OutboundOrderId);

        var order = await repo.GetEntityWithSpecAsync(spec, cancellationToken);

        if (order == null || order.IsDeleted)
            return Result<bool>.Failure(ErrorCodeConstants.ValidationError, "Không tìm thấy phiếu xuất kho.");

        if (order.Status != "Pending" && order.Status != "Draft" && order.Status != "New")
            return Result<bool>.Failure(ErrorCodeConstants.ValidationError, "Chỉ được phân bổ đơn mới chưa bước vào picking/shipping.");

        // Nếu tất cả các Line Items đều đã được Pick hoặc Allocated, không cần tạo task nữa
        if (order.Items.All(i => i.Status == "Allocated" || i.Status == "Picked"))
            return Result<bool>.Failure(ErrorCodeConstants.ValidationError, "Đơn hàng này đã được phân bổ nhặt hàng trước đó.");

        // BẮT ĐẦU GIAO TÁC (Transaction logic): 
        // Trong thực tế, bạn sẽ Join với BinInventory để tính toán (Soft Allocate) tồn kho khả dụng. 
        // Ở bước này, ta cập nhật trạng thái các Item sang "Allocated" để chốt kế hoạch đi nhặt.

        foreach (var item in order.Items.Where(i => i.Status == "Pending"))
        {
            item.Status = "Allocated";
            // Nếu hệ thống của bạn có bảng PickTask, đây là lúc bạn thêm mới vào _unitOfWork.Repository<PickTask>().AddAsync(...)
        }

        order.Status = "Allocated"; // Đổi trạng thái tổng của phiếu xuất
        // order.AssignedUserId = request.RequestData.AssignedUserId; // Nếu Entity của bạn có thuộc tính này

        repo.Update(order);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, $"Đã tạo lệnh nhặt hàng (Pick Task) thành công cho đơn xuất {order.Id}.");
    }
}