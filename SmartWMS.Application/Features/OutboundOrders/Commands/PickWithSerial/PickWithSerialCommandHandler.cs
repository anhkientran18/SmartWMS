using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.PickWithSerial;

public class PickWithSerialCommandHandler : IRequestHandler<PickWithSerialCommand, Result<List<string>>>
{
    private readonly IApplicationDbContext _context;

    public PickWithSerialCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<List<string>>> Handle(PickWithSerialCommand command, CancellationToken cancellationToken)
    {
        var request = command.RequestData;
        if (request.OrderId == Guid.Empty || request.ProductId == Guid.Empty || request.BinId == Guid.Empty ||
            request.ScannedSerials == null || request.ScannedSerials.Count == 0 ||
            request.ScannedSerials.Any(string.IsNullOrWhiteSpace) ||
            request.ScannedSerials.Distinct(StringComparer.Ordinal).Count() != request.ScannedSerials.Count)
            return Result<List<string>>.Failure(ErrorCodeConstants.ValidationError, "Đơn hàng, sản phẩm, ô kệ và danh sách serial không trùng lặp là bắt buộc.");

        var order = await _context.OutboundIssues.Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.Id == request.OrderId && !x.IsDeleted, cancellationToken);
        if (order == null)
            return Result<List<string>>.Failure(ErrorCodeConstants.ValidationError, "Không tìm thấy đơn hàng xuất.");
        if (order.Items.Any(x => x.IsDirectPick) || !await _context.Products.AnyAsync(x => x.Id == request.ProductId &&
            !x.IsDeleted && x.TrackingMode == ProductTrackingMode.Serial, cancellationToken))
            return Result<List<string>>.Failure(ErrorCodeConstants.Conflict, "Legacy serial endpoint không hỗ trợ B3 None/Lot/direct-pick; dùng quantity-based pick.");
        if (order.Status != "Allocated" && order.Status != "Waved")
            return Result<List<string>>.Failure(ErrorCodeConstants.ValidationError, "Đơn hàng phải được phân bổ trước khi picking và chưa được pick hoàn tất.");
        if (string.IsNullOrWhiteSpace(order.OrderNumber) ||
            (!string.IsNullOrEmpty(request.OrderCode) && request.OrderCode != order.OrderNumber) ||
            await _context.OutboundIssues.AnyAsync(x => x.Id != order.Id && x.OrderNumber == order.OrderNumber, cancellationToken))
            return Result<List<string>>.Failure(ErrorCodeConstants.ValidationError, "Mã đơn hàng không khớp, bị trống hoặc không duy nhất; không thể xác định tiến độ serial.");

        var lines = order.Items.Where(x => x.ProductId == request.ProductId).OrderBy(x => x.Id).ToList();
        if (lines.Count == 0 || lines.Any(x => x.Quantity <= 0 ||
            (x.Status != "Allocated" && x.Status != "Waved" && x.Status != "Picked")))
            return Result<List<string>>.Failure(ErrorCodeConstants.ValidationError, "Sản phẩm không thuộc dòng đơn hàng được phép picking.");

        // The current model stores progress through serials linked by the unique order number.
        var previouslyPicked = await _context.ProductSerialNumbers.LongCountAsync(x =>
            x.ProductId == request.ProductId && x.OutboundOrderCode == order.OrderNumber &&
            (x.Status == "Allocated" || x.Status == "Shipped"), cancellationToken);
        var remaining = lines.Sum(x => (long)x.Quantity) - previouslyPicked;
        if (remaining <= 0 || request.ScannedSerials.Count > remaining)
            return Result<List<string>>.Failure(ErrorCodeConstants.ValidationError, "Số lượng serial vượt số lượng còn cần pick của đơn hàng.");

        var serials = await _context.ProductSerialNumbers
            .Where(x => x.ProductId == request.ProductId && request.ScannedSerials.Contains(x.SerialCode))
            .ToListAsync(cancellationToken);
        if (serials.Count != request.ScannedSerials.Count ||
            serials.Select(x => x.SerialCode).Distinct(StringComparer.Ordinal).Count() != request.ScannedSerials.Count ||
            serials.Any(x => x.Status != "InStock" || !string.IsNullOrEmpty(x.OutboundOrderCode) || !x.BinInventoryId.HasValue))
            return Result<List<string>>.Failure(ErrorCodeConstants.ValidationError, "Serial không tồn tại, không thuộc sản phẩm, đã sử dụng hoặc thiếu liên kết tồn kho.");

        var inventoryIds = serials.Select(x => x.BinInventoryId!.Value).Distinct().ToList();
        var stocks = await _context.BinInventories.Include(x => x.Bin).ThenInclude(x => x!.Zone).ThenInclude(x => x!.Warehouse)
            .Where(x => inventoryIds.Contains(x.Id)).ToListAsync(cancellationToken);
        var stockById = stocks.ToDictionary(x => x.Id);
        foreach (var group in serials.GroupBy(x => x.BinInventoryId!.Value))
        {
            if (!stockById.TryGetValue(group.Key, out var stock) || stock.ProductId != request.ProductId ||
                stock.BinId != request.BinId || stock.Status != InventoryStatus.Available ||
                stock.Bin == null || stock.Bin.IsDeleted || stock.Bin.Zone == null ||
                stock.Bin.Zone.IsDeleted || stock.Bin.Zone.Warehouse == null || stock.Bin.Zone.Warehouse.IsDeleted ||
                stock.Quantity < group.Count())
                return Result<List<string>>.Failure(ErrorCodeConstants.ValidationError, "Serial không ở ô kệ yêu cầu hoặc tồn kho không hợp lệ/không khả dụng/không đủ số lượng.");
        }
        if (stocks.GroupBy(x => x.BinId).Any(g => g.First().Bin!.CurrentOccupancy < serials.Count(x => g.Any(s => s.Id == x.BinInventoryId))))
            return Result<List<string>>.Failure(ErrorCodeConstants.ValidationError, "Số lượng occupancy của ô kệ không đủ để picking; cần đối soát tồn kho.");

        // Validate the entire batch before changing any serial, inventory or order state.
        foreach (var serial in serials)
        {
            var stock = stockById[serial.BinInventoryId!.Value];
            serial.Status = "Allocated";
            serial.OutboundOrderCode = order.OrderNumber;
            stock.Quantity--;
            stock.Bin!.CurrentOccupancy--;
            // Retain zero-quantity rows because serials still reference this inventory record.
            _context.InventoryTransactions.Add(new InventoryTransaction
            {
                Id = Guid.NewGuid(),
                ProductId = request.ProductId,
                TransactionType = "OUTBOUND_SERIAL",
                QuantityChanged = -1,
                SourceBinCode = stock.Bin.Code,
                DestinationBinCode = "SHIPPING_DOCK",
                ReasonCode = $"SERIAL_PICKED_{serial.SerialCode}",
                CreatedBy = "Serial_Scanner",
                CreatedAt = DateTime.UtcNow
            });
        }

        var pickedForLines = previouslyPicked + serials.Count;
        foreach (var line in lines)
        {
            line.Status = pickedForLines >= line.Quantity ? "Picked" : order.Status;
            pickedForLines = Math.Max(0, pickedForLines - line.Quantity);
        }
        if (order.Items.All(x => x.Status == "Picked"))
            order.Status = "Picked";

        await _context.SaveChangesAsync(cancellationToken);
        return Result<List<string>>.Success(request.ScannedSerials, $"Đã pick và trừ tồn {serials.Count} serial cho đơn hàng {order.OrderNumber}.");
    }
}
