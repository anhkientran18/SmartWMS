using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.AuditLogs.Queries.Dtos;

namespace SmartWMS.Application.Features.AuditLogs.Queries;

public class GetAuditLogsQueryHandler : IRequestHandler<GetAuditLogsQuery, Result<AuditLogPaginationDto>>
{
    private readonly IApplicationDbContext _context;

    public GetAuditLogsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<AuditLogPaginationDto>> Handle(GetAuditLogsQuery request, CancellationToken cancellationToken)
    {
        // Lấy tổng số dòng nhật ký
        var totalRecords = await _context.AuditLogs.CountAsync(cancellationToken);

        // Phân trang và sắp xếp mới nhất lên đầu
        var logs = await _context.AuditLogs
            .AsNoTracking()
            .OrderByDescending(a => a.DateTime)
            .Skip((request.PageNumber - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(a => new AuditLogDto
            {
                Id = a.Id,
                UserId = a.UserId,
                Type = a.Type,
                TableName = a.TableName,
                DateTime = a.DateTime,
                OldValues = a.OldValues ?? "",
                NewValues = a.NewValues ?? "",
                AffectedColumns = a.AffectedColumns ?? ""
            })
            .ToListAsync(cancellationToken);

        var result = new AuditLogPaginationDto
        {
            TotalRecords = totalRecords,
            TotalPages = (int)Math.Ceiling(totalRecords / (double)request.PageSize),
            Logs = logs
        };

        return Result<AuditLogPaginationDto>.Success(result, "Truy xuất nhật ký hệ thống thành công.");
    }
}