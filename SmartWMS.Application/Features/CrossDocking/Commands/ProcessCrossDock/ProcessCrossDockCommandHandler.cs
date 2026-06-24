using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Events; // Import Namespace chứa sự kiện Real-time
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.CrossDocking.Commands.ProcessCrossDock.Dtos;
using SmartWMS.Domain.Entities;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.CrossDocking.Commands.ProcessCrossDock;

public class ProcessCrossDockCommandHandler : IRequestHandler<ProcessCrossDockCommand, Result<CrossDockResultDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly IMediator _mediator; // Thêm biến điều phối sự kiện

    public ProcessCrossDockCommandHandler(IApplicationDbContext context, IMediator mediator)
    {
        _context = context;
        _mediator = mediator;
    }

    public async Task<Result<CrossDockResultDto>> Handle(ProcessCrossDockCommand request, CancellationToken cancellationToken)
    {
        if (request.IncomingQuantity <= 0)
        {
            return Result<CrossDockResultDto>.Failure("Số lượng hàng nhập kho kích hoạt Cross-Dock phải lớn hơn 0.");
        }

        var pendingOutboundLines = await _context.OutboundOrderItems
            .Where(x => x.ProductId == request.ProductId && x.Status == "Pending")
            .OrderBy(x => x.CreatedAt)
            .ToListAsync(cancellationToken);

        var resultDto = new CrossDockResultDto
        {
            ProductId = request.ProductId,
            TotalIncomingQuantity = request.IncomingQuantity
        };

        int availableToCrossDock = request.IncomingQuantity;

        foreach (var outboundLine in pendingOutboundLines)
        {
            if (availableToCrossDock <= 0) break;

            int matchQuantity = Math.Min(outboundLine.Quantity, availableToCrossDock);

            if (matchQuantity == outboundLine.Quantity)
            {
                outboundLine.Status = "Allocated";
            }
            else
            {
                outboundLine.Quantity -= matchQuantity;

                var partialAllocatedLine = new OutboundOrderItem
                {
                    Id = Guid.NewGuid(),
                    OrderId = outboundLine.OrderId,
                    ProductId = outboundLine.ProductId,
                    Quantity = matchQuantity,
                    Status = "Allocated",
                    CreatedAt = DateTime.UtcNow
                };
                _context.OutboundOrderItems.Add(partialAllocatedLine);
            }

            var crossDockTransaction = new InventoryTransaction
            {
                Id = Guid.NewGuid(),
                ProductId = request.ProductId,
                TransactionType = "CROSS_DOC_BYPASS",
                QuantityChanged = matchQuantity,
                SourceBinCode = request.SourceDockCode,
                DestinationBinCode = "SHIPPING_DOCK",
                ReasonCode = $"CROSS_DOCK_MATCHED_ORDER_{outboundLine.OrderId}",
                CreatedBy = "WMS_CrossDockEngine",
                CreatedAt = DateTime.UtcNow
            };
            _context.InventoryTransactions.Add(crossDockTransaction);

            availableToCrossDock -= matchQuantity;
        }

        resultDto.CrossDockedQuantity = request.IncomingQuantity - availableToCrossDock;
        resultDto.RemainderForPutaway = availableToCrossDock;

        if (resultDto.CrossDockedQuantity > 0)
        {
            await _context.SaveChangesAsync(cancellationToken);

            // ============================================================================
            // 🌟 PHÁT SÓNG REAL-TIME: Thông báo bẻ luồng bốc hàng cắt ngang thành công
            // ============================================================================
            await _mediator.Publish(new InventoryChangedEvent
            {
                EventType = "CROSS_DOCK_EXEC",
                Message = $"Kích hoạt luồng Cross-Dock! Xuất thẳng {resultDto.CrossDockedQuantity} sản phẩm đi đóng gói, bỏ qua lưu kho kệ."
            }, cancellationToken);
            // ============================================================================

            resultDto.ExecutionSummary = $"Hệ thống đã kích hoạt Cross-Dock thành công! Xuất thẳng {resultDto.CrossDockedQuantity} sản phẩm ra cầu xuất tàu. Còn dư {resultDto.RemainderForPutaway} sản phẩm cần làm lệnh Putaway cất lên kệ lưu trữ.";
        }
        else
        {
            resultDto.ExecutionSummary = "Không tìm thấy bất kỳ đơn hàng xuất nào đang chờ mặt hàng này. Toàn bộ lô hàng sẽ chuyển sang luồng cất kho truyền thống.";
        }

        return Result<CrossDockResultDto>.Success(resultDto, "Xử lý luồng cắt ngang Cross-Dock hoàn tất.");
    }
}