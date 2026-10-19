using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.OutboundOrders.Commands.ValidatePackingWeight;
using SmartWMS.Application.Features.OutboundOrders.DTOs.Commands;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.ShipOutboundOrder;

public class ShipOutboundOrderCommandHandler(IApplicationDbContext context, ISender sender)
    : IRequestHandler<ShipOutboundOrderCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(ShipOutboundOrderCommand request, CancellationToken cancellationToken)
    {
        var checks = request.RequestData?.PackingChecks;
        if (request.OrderId == Guid.Empty || checks == null || checks.Count == 0 ||
            checks.Any(x => x == null || string.IsNullOrWhiteSpace(x.SKU) || x.Quantity <= 0 ||
                !double.IsFinite(x.ActualWeightGrams) || x.ActualWeightGrams <= 0 ||
                (x.OrderId != Guid.Empty && x.OrderId != request.OrderId)) ||
            checks.Select(x => x.SKU).Distinct(StringComparer.Ordinal).Count() != checks.Count)
            return Invalid("Cần một kết quả cân hợp lệ cho từng SKU của đúng đơn hàng.");

        var order = await context.OutboundIssues.Include(x => x.Items).ThenInclude(x => x.Product)
            .FirstOrDefaultAsync(x => x.Id == request.OrderId && !x.IsDeleted, cancellationToken);
        if (order == null)
            return Result<bool>.Failure(ErrorCodeConstants.NotFound, "Không tìm thấy đơn hàng xuất.");
        if (order.Status != "Picked" || order.Items.Count == 0 ||
            order.Items.Any(x => x.Status != "Picked" || x.Quantity <= 0 || x.Product == null || x.Product.IsDeleted))
            return Invalid("Chỉ được ship đơn Picked khi toàn bộ dòng đã pick đủ và sản phẩm còn hợp lệ.");
        if (string.IsNullOrWhiteSpace(order.OrderNumber) || await context.OutboundIssues
            .AnyAsync(x => x.Id != order.Id && x.OrderNumber == order.OrderNumber, cancellationToken))
            return Result<bool>.Failure(ErrorCodeConstants.Conflict, "Mã đơn trống hoặc trùng; không thể xác định serial của đơn.");

        var demand = order.Items.GroupBy(x => x.ProductId).Select(g => new
        {
            ProductId = g.Key,
            SKU = g.First().Product!.SKU,
            Quantity = g.Sum(x => (long)x.Quantity)
        }).ToList();
        if (demand.Any(x => x.Quantity > int.MaxValue) || checks.Count != demand.Count ||
            demand.Any(x => !checks.Any(c => c.SKU == x.SKU && c.Quantity == x.Quantity)))
            return Invalid("Kết quả cân phải bao phủ đúng toàn bộ SKU và số lượng của đơn hàng.");

        // Picking already deducted inventory. Serials are the existing persisted progress source.
        var serials = await context.ProductSerialNumbers.Where(x => x.OutboundOrderCode == order.OrderNumber)
            .ToListAsync(cancellationToken);
        if (serials.Any(x => x.Status != "Allocated" || string.IsNullOrWhiteSpace(x.SerialCode)) ||
            serials.GroupBy(x => new { x.ProductId, x.SerialCode }).Any(g => g.Count() != 1) ||
            serials.Any(x => !demand.Any(d => d.ProductId == x.ProductId)) ||
            demand.Any(x => serials.LongCount(s => s.ProductId == x.ProductId) != x.Quantity))
            return Result<bool>.Failure(ErrorCodeConstants.Conflict, "Serial của đơn chưa đủ hoặc trạng thái không khớp với picking hoàn tất.");

        // Reuse the same per-SKU packing calculation; validate every check before any state mutation.
        foreach (var item in demand)
        {
            var input = checks.Single(x => x.SKU == item.SKU);
            var weight = await sender.Send(new ValidatePackingWeightCommand(new ValidatePackingWeightRequest
            {
                OrderId = order.Id,
                SKU = item.SKU,
                Quantity = (int)item.Quantity,
                ActualWeightGrams = input.ActualWeightGrams
            }), cancellationToken);
            if (!weight.IsSuccess || weight.Data == null || !weight.Data.IsValid)
                return Invalid(weight.Error?.Message ?? weight.Data?.StatusMessage ?? "Packing validation thất bại.");
        }

        foreach (var serial in serials) serial.Status = "Shipped";
        foreach (var line in order.Items) line.Status = "Shipped";
        order.Status = "Shipped";
        await context.SaveChangesAsync(cancellationToken);
        return Result<bool>.Success(true, "Đã xác nhận packing và chuyển đơn/line/serial sang Shipped. Không trừ tồn lần nữa.");
    }

    private static Result<bool> Invalid(string message) => Result<bool>.Failure(ErrorCodeConstants.ValidationError, message);
}
