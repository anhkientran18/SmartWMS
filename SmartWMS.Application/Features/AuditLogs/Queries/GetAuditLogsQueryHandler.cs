using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.AuditLogs.DTOs.Queries;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.AuditLogs.Queries.GetAuditLogs;

public class GetAuditLogsQueryHandler : IRequestHandler<GetAuditLogsQuery, Result<PaginatedResult<AuditLogDto>>>
{
    private readonly IApplicationDbContext _context;

    public GetAuditLogsQueryHandler(IApplicationDbContext context) => _context = context;

    public async Task<Result<PaginatedResult<AuditLogDto>>> Handle(GetAuditLogsQuery request, CancellationToken cancellationToken)
    {
        var req = request.RequestData;

        // Truy vấn thẳng qua DbContext để tối ưu tốc độ đọc Log
        var query = _context.AuditLogs.AsNoTracking();

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(x => x.DateTime) // Sắp xếp theo trường DateTime của bạn
            .Skip((req.PageIndex - 1) * req.PageSize)
            .Take(req.PageSize)
            .Select(x => new AuditLogDto
            {
                Id = x.Id,
                UserId = x.UserId,
                Type = x.Type,
                TableName = x.TableName,
                DateTime = x.DateTime,
                OldValues = x.OldValues,
                NewValues = x.NewValues,
                AffectedColumns = x.AffectedColumns,
                IpAddress = x.IpAddress
            })
            .ToListAsync(cancellationToken);

        return Result<PaginatedResult<AuditLogDto>>.Success(
            PaginatedResult<AuditLogDto>.Create(items, totalCount, req.PageIndex, req.PageSize)
        );
    }
}