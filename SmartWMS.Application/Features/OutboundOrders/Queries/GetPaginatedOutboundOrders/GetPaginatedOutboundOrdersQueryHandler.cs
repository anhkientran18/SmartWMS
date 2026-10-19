using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.OutboundOrders.DTOs;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.OutboundOrders.Queries.GetPaginatedOutboundOrders;

public sealed class GetPaginatedOutboundOrdersQueryHandler : IRequestHandler<GetPaginatedOutboundOrdersQuery, Result<PaginatedResult<OutboundOrderDto>>>
{
    private readonly IApplicationDbContext _context;

    public GetPaginatedOutboundOrdersQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<PaginatedResult<OutboundOrderDto>>> Handle(GetPaginatedOutboundOrdersQuery request, CancellationToken cancellationToken)
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

        if (!string.IsNullOrWhiteSpace(req.SearchKeyword))
        {
            var search = req.SearchKeyword.Trim().ToLower();
            query = query.Where(x => x.Notes != null && x.Notes.ToLower().Contains(search));
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var dtoItems = await query
            .OrderByDescending(x => x.CreatedAt)
            .Skip((req.PageIndex - 1) * req.PageSize)
            .Take(req.PageSize)
            .Select(x => new OutboundOrderDto
            {
                Id = x.Id,
                CustomerId = x.CustomerId,
                CustomerName = x.Customer != null ? x.Customer.Name : "N/A",
                Status = x.Status,
                CreatedAt = x.CreatedAt,
                CreatedBy = x.CreatedBy
            })
            .ToListAsync(cancellationToken);

        var result = PaginatedResult<OutboundOrderDto>.Create(dtoItems, totalCount, req.PageIndex, req.PageSize);

        return Result<PaginatedResult<OutboundOrderDto>>.Success(result);
    }
}