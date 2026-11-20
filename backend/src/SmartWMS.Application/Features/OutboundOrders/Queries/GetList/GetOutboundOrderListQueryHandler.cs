using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.OutboundOrders.DTOs;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.OutboundOrders.Queries.GetList;

public sealed class GetOutboundOrderListQueryHandler : IRequestHandler<GetOutboundOrderListQuery, Result<List<OutboundOrderDto>>>
{
    private readonly IApplicationDbContext _context;

    public GetOutboundOrderListQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<List<OutboundOrderDto>>> Handle(GetOutboundOrderListQuery request, CancellationToken cancellationToken)
    {
        var req = request.RequestData;

        var query = _context.OutboundIssues
            .AsNoTracking()
            .Include(x => x.Customer)
            .Where(x => !x.IsDeleted);

        if (req.CustomerId.HasValue && req.CustomerId.Value != Guid.Empty)
        {
            query = query.Where(x => x.CustomerId == req.CustomerId.Value);
        }

        if (!string.IsNullOrWhiteSpace(req.Status))
        {
            query = query.Where(x => x.Status == req.Status);
        }

        if (!string.IsNullOrWhiteSpace(req.SearchKeyword))
        {
            var search = req.SearchKeyword.Trim().ToLower();
            query = query.Where(x => x.Notes != null && x.Notes.ToLower().Contains(search));
        }

        var orders = await query
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new OutboundOrderDto
            {
                Id = x.Id,
                BinId = x.BinId,
                OrderNumber = x.OrderNumber,
                IsDirectPick = x.Items.Any(i => i.IsDirectPick),
                CustomerId = x.CustomerId,
                CustomerName = x.Customer != null ? x.Customer.Name : "N/A",
                Status = x.Status,
                CreatedAt = x.CreatedAt,
                CreatedBy = x.CreatedBy
            })
            .ToListAsync(cancellationToken);

        return Result<List<OutboundOrderDto>>.Success(orders);
    }
}
