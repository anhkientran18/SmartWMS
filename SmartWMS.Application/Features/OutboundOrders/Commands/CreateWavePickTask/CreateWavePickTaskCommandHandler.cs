using MediatR;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.OutboundOrders.Specifications.Commands;
using SmartWMS.Domain.Entities;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.CreateWavePickTask;

public sealed class CreateWavePickTaskCommandHandler : IRequestHandler<CreateWavePickTaskCommand, Result<string>>
{
    private readonly IUnitOfWork _unitOfWork;

    public CreateWavePickTaskCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<string>> Handle(CreateWavePickTaskCommand request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<OutboundIssue>();
        var reqIds = request.RequestData.OutboundOrderIds;

        // Lấy danh sách các đơn hàng xuất hợp lệ
        var spec = new OutboundOrdersByIdsSpec(reqIds);
        var orders = await repo.ListAsync(spec, cancellationToken);

        if (orders.Count == 0)
            return Result<string>.Failure(ErrorCodeConstants.ValidationError, "Các đơn hàng yêu cầu gom chuyến không tồn tại hoặc đã bị xóa.");

        if (orders.Any(o => o.IsDeleted || (o.Status != "Pending" && o.Status != "Allocated" && o.Status != "Waved") ||
            o.Items.Any(i => i.Status == "Picked" || i.Status == "Shipped")))
            return Result<string>.Failure(ErrorCodeConstants.ValidationError, "Chỉ được gom chuyến đơn Pending/Allocated/Waved chưa có dòng Picked/Shipped.");

        // THUẬT TOÁN GOM CHUYẾN (Wave Consolidation):
        // 1. Trích xuất tất cả các Line Items từ các đơn hàng.
        // 2. Gom nhóm (GroupBy) theo ProductId để nhân viên chỉ nhặt 1 lần với tổng số lượng.
        var allItems = orders.SelectMany(o => o.Items).ToList();

        var groupedWaveItems = allItems
            .GroupBy(i => i.ProductId)
            .Select(g => new
            {
                ProductId = g.Key,
                TotalQuantityToPick = g.Sum(i => i.Quantity),
                RelatedOrderIds = g.Select(i => i.OrderId).Distinct().ToList()
            }).ToList();

        // Đánh dấu các đơn này đã được phân bổ vào Wave
        foreach (var order in orders)
        {
            order.Status = "Waved";
            foreach (var item in order.Items)
            {
                item.Status = "Waved";
            }
            repo.Update(order);
        }

        // Tạo mã Wave (ví dụ: WAVE-20231027-001)
        string waveCode = $"WAVE-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString().Substring(0, 5).ToUpper()}";

        // Nếu hệ thống của bạn có bảng WavePick / PickTask, bạn sẽ tạo bản ghi mới tại đây
        // var waveRepo = _unitOfWork.Repository<WavePick>(); ...

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        string summaryMsg = $"Tạo chuyến nhặt hàng {waveCode} thành công! Gom {orders.Count} đơn hàng thành {groupedWaveItems.Count} nhóm sản phẩm cần nhặt.";
        return Result<string>.Success(waveCode, summaryMsg);
    }
}