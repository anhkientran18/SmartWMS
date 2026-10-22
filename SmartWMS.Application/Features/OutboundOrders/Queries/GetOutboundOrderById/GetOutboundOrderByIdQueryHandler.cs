using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.OutboundOrders.DTOs;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.OutboundOrders.Queries.GetOutboundOrderById;

public sealed class GetOutboundOrderByIdQueryHandler : IRequestHandler<GetOutboundOrderByIdQuery, Result<OutboundOrderDto>>
{
    private readonly IApplicationDbContext _context;

    public GetOutboundOrderByIdQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<OutboundOrderDto>> Handle(GetOutboundOrderByIdQuery request, CancellationToken cancellationToken)
    {
        var order = await _context.OutboundIssues
            .AsNoTracking()
            .Include(x => x.Customer)
            .Include(x => x.Items)
                .ThenInclude(i => i.Product)
            .FirstOrDefaultAsync(x => x.Id == request.RequestData.Id && !x.IsDeleted, cancellationToken);

        if (order == null)
        {
            return Result<OutboundOrderDto>.Failure(ErrorCodeConstants.NotFound, "Không tìm thấy thông tin đơn xuất kho yêu cầu.");
        }

        var dto = new OutboundOrderDto
        {
            Id = order.Id,
            OrderNumber = order.OrderNumber,
            IsDirectPick = order.Items.Any(x => x.IsDirectPick),
            BinId = order.BinId,
            CustomerId = order.CustomerId,
            CustomerName = order.Customer != null ? order.Customer.Name : "N/A",
            Status = order.Status,
            CreatedAt = order.CreatedAt,
            CreatedBy = order.CreatedBy,
            Items = order.Items.Select(i => new OutboundOrderItemDto
            {
                Id = i.Id,
                ProductId = i.ProductId,
                ProductName = i.Product != null ? i.Product.Name : "N/A",
                SKU = i.Product != null ? i.Product.SKU : "N/A",
                Quantity = i.Quantity,
                IsDirectPick = i.IsDirectPick,
                TrackingModeSnapshot = i.TrackingModeSnapshot,
                ReservedQuantity = i.ReservedQuantity,
                PickedQuantity = i.PickedQuantity,
                ShippedQuantity = i.ShippedQuantity,
                Status = i.Status
            }).ToList()
        };

        var reservations = await _context.InventoryReservations.AsNoTracking().Where(x => x.OrderId == order.Id).ToListAsync(cancellationToken);
        foreach (var item in dto.Items)
            item.Reservations = reservations.Where(x => x.OrderItemId == item.Id).OrderBy(x => x.Id).Select(x => new OutboundReservationDto
            {
                Id=x.Id, AllocationId=x.AllocationId, SourceBinInventoryId=x.SourceBinInventoryId,
                LotNumber=x.SourceLotNumber, ExpirationDate=x.SourceExpirationDate, Quantity=x.Quantity,
                PickedQuantity=x.PickedQuantity, ShippedQuantity=x.ShippedQuantity, ReleasedQuantity=x.ReleasedQuantity, Status=x.Status
            }).ToList();

        return Result<OutboundOrderDto>.Success(dto);
    }
}
