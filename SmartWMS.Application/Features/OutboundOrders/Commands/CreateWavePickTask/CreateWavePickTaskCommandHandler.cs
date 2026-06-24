using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Events; // Import Namespace chứa sự kiện Real-time
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.OutboundOrders.Commands.CreateWavePickTask.Dtos;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.CreateWavePickTask;

public class CreateWavePickTaskCommandHandler : IRequestHandler<CreateWavePickTaskCommand, Result<WavePickTaskResultDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly IMediator _mediator;
    private readonly IPickingRouteOptimizer _routeOptimizer; // ĐÃ BỔ SUNG: Khai báo bộ tối ưu định tuyến bốc hàng

    // ĐÃ CẬP NHẬT: Tiêm trọn vẹn các dịch vụ lõi thông qua cơ chế DI Container
    public CreateWavePickTaskCommandHandler(
        IApplicationDbContext context,
        IMediator mediator,
        IPickingRouteOptimizer routeOptimizer)
    {
        _context = context;
        _mediator = mediator;
        _routeOptimizer = routeOptimizer;
    }

    public async Task<Result<WavePickTaskResultDto>> Handle(CreateWavePickTaskCommand request, CancellationToken cancellationToken)
    {
        if (request.OrderIds == null || !request.OrderIds.Any())
        {
            return Result<WavePickTaskResultDto>.Failure("Thao tác bị từ chối. Phải chọn tối thiểu một đơn hàng để khởi tạo sóng xuất kho.");
        }

        var orderLines = await _context.OutboundOrderItems
            .Where(x => request.OrderIds.Contains(x.OrderId) && x.Status == "Pending")
            .ToListAsync(cancellationToken);

        if (!orderLines.Any())
        {
            return Result<WavePickTaskResultDto>.Failure("Không tìm thấy sản phẩm hợp lệ nào ở trạng thái chờ xuất trong các đơn hàng đã chọn.");
        }

        var consolidatedDemands = orderLines
            .GroupBy(l => l.ProductId)
            .Select(g => new
            {
                ProductId = g.Key,
                TotalQtyNeeded = g.Sum(x => x.Quantity)
            })
            .ToList();

        var resultDto = new WavePickTaskResultDto
        {
            WaveCode = $"WAVE-{DateTime.Now:yyyyMMdd}-{new Random().Next(100, 999)}",
            TotalOrdersProcessed = request.OrderIds.Count
        };

        foreach (var demand in consolidatedDemands)
        {
            var product = await _context.Products
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == demand.ProductId, cancellationToken);

            if (product == null) continue;

            var pickItemDto = new ConsolidatedPickItemDto
            {
                ProductId = demand.ProductId,
                SKU = product.SKU ?? string.Empty,
                ProductName = product.Name ?? string.Empty,
                TotalRequiredQuantity = demand.TotalQtyNeeded
            };

            var availableStocks = await _context.BinInventories
                .Include(x => x.Bin)
                .Where(x => x.ProductId == demand.ProductId &&
                            x.Status == InventoryStatus.Available &&
                            x.Quantity > 0)
                .OrderBy(x => x.ExpirationDate)
                .ToListAsync(cancellationToken);

            int remainingToAllocate = demand.TotalQtyNeeded;

            foreach (var stock in availableStocks)
            {
                if (remainingToAllocate <= 0) break;
                if (stock.Bin == null) continue;

                int takeQuantity = Math.Min(stock.Quantity, remainingToAllocate);

                pickItemDto.AssignedLocations.Add(new WavePickAllocationZoneDto
                {
                    BinId = stock.BinId,
                    BinCode = stock.Bin.Code ?? "UNKNOWN",
                    LotNumber = stock.LotNumber ?? "N/A",
                    QuantityToPick = takeQuantity
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
                    ProductId = demand.ProductId,
                    TransactionType = "WAVE_OUTBOUND",
                    QuantityChanged = -takeQuantity,
                    SourceBinCode = stock.Bin.Code ?? "UNKNOWN",
                    DestinationBinCode = "SHIPPING_DOCK",
                    ReasonCode = $"WAVE_ALLOCATION_{resultDto.WaveCode}",
                    CreatedBy = "WMS_WaveEngine",
                    CreatedAt = DateTime.UtcNow
                };
                _context.InventoryTransactions.Add(transaction);

                remainingToAllocate -= takeQuantity;
            }

            resultDto.ConsolidatedPickInstructions.Add(pickItemDto);
        }

        foreach (var line in orderLines)
        {
            line.Status = "Allocated";
        }

        // Thực thi ghi sổ cơ sở dữ liệu
        await _context.SaveChangesAsync(cancellationToken);

        // ============================================================================
        // 🌟 ĐÃ BỔ SUNG: THỰC THI GIẢI THUẬT ĐỊNH TUYẾN S-SHAPE HEURISTIC RÀNG BUỘC KỆ
        // Tự động nắn thẳng danh sách ô kệ cần đi qua thành chuỗi hành trình tối ưu nhất
        // ============================================================================
        foreach (var pickItem in resultDto.ConsolidatedPickInstructions)
        {
            pickItem.AssignedLocations = _routeOptimizer.OptimizeBySShape(
                pickItem.AssignedLocations,
                x => x.BinCode
            );
        }
        // ============================================================================

        // ============================================================================
        // 🌟 PHÁT SÓNG REAL-TIME: Thông báo khởi tạo Sóng bốc hàng thành công
        // ============================================================================
        await _mediator.Publish(new InventoryChangedEvent
        {
            EventType = "WAVE_CREATED",
            Message = $"Hệ thống vừa gộp thành công {resultDto.TotalOrdersProcessed} đơn hàng vào đợt sóng xuất kho mã: {resultDto.WaveCode}."
        }, cancellationToken);
        // ============================================================================

        return Result<WavePickTaskResultDto>.Success(resultDto, $"Khởi tạo thành công đợt sóng xuất kho tổng hợp {resultDto.WaveCode}. Đã gộp và tối ưu lộ trình di chuyển.");
    }
}