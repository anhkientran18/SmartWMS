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
                Status = i.Status
            }).ToList()
        };

        return Result<OutboundOrderDto>.Success(dto);
    }
}