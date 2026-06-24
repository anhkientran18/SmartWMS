using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Events; // Import Namespace chứa sự kiện Real-time
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.OutboundOrders.Commands.CreatePickTask.Dtos;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.CreatePickTask;

public class CreatePickTaskCommandHandler : IRequestHandler<CreatePickTaskCommand, Result<PickTaskResultDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly IMediator _mediator; // Thêm biến điều phối sự kiện

    public CreatePickTaskCommandHandler(IApplicationDbContext context, IMediator mediator)
    {
        _context = context;
        _mediator = mediator;
    }

    public async Task<Result<PickTaskResultDto>> Handle(CreatePickTaskCommand request, CancellationToken cancellationToken)
    {
        if (request.RequestedQuantity <= 0)
        {
            return Result<PickTaskResultDto>.Failure("Số lượng yêu cầu xuất kho phải lớn hơn 0.");
        }

        var availableStocks = await _context.BinInventories
            .Include(x => x.Bin)
            .Where(x => x.ProductId == request.ProductId &&
                        x.Status == InventoryStatus.Available &&
                        x.Quantity > 0)
            .OrderBy(x => x.ExpirationDate)
            .ToListAsync(cancellationToken);

        int totalAvailableStock = availableStocks.Sum(x => x.Quantity);
        if (totalAvailableStock == 0)
        {
            return Result<PickTaskResultDto>.Failure("Sản phẩm này hiện tại đã hoàn toàn hết hàng khả dụng trong kho.");
        }

        var resultDto = new PickTaskResultDto
        {
            ProductId = request.ProductId,
            IsFullyAllocated = totalAvailableStock >= request.RequestedQuantity
        };

        int remainingToAllocate = request.RequestedQuantity;

        foreach (var stock in availableStocks)
        {
            if (remainingToAllocate <= 0) break;
            if (stock.Bin == null) continue;

            int takeQuantity = Math.Min(stock.Quantity, remainingToAllocate);

            resultDto.PickInstructions.Add(new PickInstructionItemDto
            {
                BinId = stock.BinId,
                BinCode = stock.Bin.Code ?? "UNKNOWN",
                LotNumber = stock.LotNumber ?? string.Empty,
                PickQuantity = takeQuantity
            });

            stock.Quantity -= takeQuantity;
            stock.Bin.CurrentOccupancy -= takeQuantity;

            if (stock.Quantity == 0)
            {
                _context.BinInventories.Remove(stock);
            }

            var transaction = new InventoryTransaction
            {
                Id = Guid.NewGuid(),
                ProductId = request.ProductId,
                TransactionType = "OUTBOUND",
                QuantityChanged = -takeQuantity,
                SourceBinCode = stock.Bin.Code ?? "UNKNOWN",
                DestinationBinCode = "SHIPPING_DOCK",
                ReasonCode = "SINGLE_ORDER_ALLOCATION",
                CreatedBy = "WarehouseOperator",
                CreatedAt = DateTime.UtcNow
            };
            _context.InventoryTransactions.Add(transaction);

            remainingToAllocate -= takeQuantity;
            resultDto.TotalAllocatedQuantity += takeQuantity;
        }

        await _context.SaveChangesAsync(cancellationToken);

        // ============================================================================
        // 🌟 PHÁT SÓNG REAL-TIME: Thông báo bốc hàng đơn lẻ thành công
        // ============================================================================
        await _mediator.Publish(new InventoryChangedEvent
        {
            EventType = "SINGLE_PICKED",
            Message = $"Đã phân bổ lệnh bốc hàng đơn lẻ thành công. Xuất kho {resultDto.TotalAllocatedQuantity} đơn vị mặt hàng ID: {request.ProductId}."
        }, cancellationToken);
        // ============================================================================

        string message = resultDto.IsFullyAllocated
            ? $"Tự động phân bổ thành công! Đã giữ chỗ {resultDto.TotalAllocatedQuantity} sản phẩm tại các vị trí tối ưu."
            : $"Cảnh báo thiếu hụt! Chỉ phân bổ được {resultDto.TotalAllocatedQuantity}/{request.RequestedQuantity} sản phẩm do kho không đủ hàng.";

        return Result<PickTaskResultDto>.Success(resultDto, message);
    }
}