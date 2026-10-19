using MediatR;
using SmartWMS.Application.Common.Events;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InboundReceipts.DTOs.Commands;
using SmartWMS.Application.Features.InboundReceipts.Specifications.Commands;
using SmartWMS.Domain.Entities;
using SmartWMS.Domain.Enums;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.InboundReceipts.Commands.ProcessCrossDocking;

public class ProcessCrossDockingCommandHandler : IRequestHandler<ProcessCrossDockingCommand, Result<CrossDockResultDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMediator _mediator;

    public ProcessCrossDockingCommandHandler(IUnitOfWork unitOfWork, IMediator mediator)
    {
        _unitOfWork = unitOfWork;
        _mediator = mediator;
    }

    public async Task<Result<CrossDockResultDto>> Handle(ProcessCrossDockingCommand request, CancellationToken cancellationToken)
    {
        var req = request.RequestData;
        var pendingLines = await _unitOfWork.Repository<OutboundOrderItem>().ListAsync(new PendingOutboundOrderItemsSpec(req.ProductId), cancellationToken);

        var resultDto = new CrossDockResultDto { ProductId = req.ProductId, TotalIncomingQuantity = req.IncomingQuantity };
        int availableToCrossDock = req.IncomingQuantity;

        foreach (var outboundLine in pendingLines)
        {
            if (availableToCrossDock <= 0) break;

            int matchQuantity = Math.Min(outboundLine.Quantity, availableToCrossDock);

            if (matchQuantity == outboundLine.Quantity) { outboundLine.Status = "Allocated"; }
            else
            {
                outboundLine.Quantity -= matchQuantity;
                await _unitOfWork.Repository<OutboundOrderItem>().AddAsync(new OutboundOrderItem
                {
                    Id = Guid.NewGuid(),
                    OrderId = outboundLine.OrderId,
                    ProductId = outboundLine.ProductId,
                    Quantity = matchQuantity,
                    Status = "Allocated",
                    CreatedAt = DateTime.UtcNow
                }, cancellationToken);
            }

            await _unitOfWork.Repository<InventoryTransaction>().AddAsync(new InventoryTransaction
            {
                Id = Guid.NewGuid(),
                ProductId = req.ProductId,
                TransactionType = TransactionType.Transfer.ToString().ToUpper(),
                QuantityChanged = matchQuantity,
                SourceBinCode = req.SourceDockCode,
                DestinationBinCode = "SHIPPING_DOCK",
                ReasonCode = $"CROSS_DOCK_MATCHED_ORDER_{outboundLine.OrderId}",
                CreatedBy = "WMS_CrossDockEngine",
                CreatedAt = DateTime.UtcNow
            }, cancellationToken);

            availableToCrossDock -= matchQuantity;
        }

        resultDto.CrossDockedQuantity = req.IncomingQuantity - availableToCrossDock;
        resultDto.RemainderForPutaway = availableToCrossDock;

        if (resultDto.CrossDockedQuantity > 0)
        {
            await _unitOfWork.SaveChangesAsync(cancellationToken);
            await _mediator.Publish(new InventoryChangedEvent { EventType = "CROSS_DOCK_EXEC", Message = $"Kích hoạt Cross-Dock! Xuất thẳng {resultDto.CrossDockedQuantity} sản phẩm đi đóng gói." }, cancellationToken);
            resultDto.ExecutionSummary = $"Thành công! Xuất thẳng {resultDto.CrossDockedQuantity} sản phẩm. Dư {resultDto.RemainderForPutaway} sản phẩm cần cất lên kệ.";
        }
        else resultDto.ExecutionSummary = "Không tìm thấy đơn hàng xuất đang chờ. Luồng cất kho truyền thống sẽ được kích hoạt.";

        return Result<CrossDockResultDto>.Success(resultDto);
    }
}