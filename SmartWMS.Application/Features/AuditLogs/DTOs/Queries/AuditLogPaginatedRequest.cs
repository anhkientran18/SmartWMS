namespace SmartWMS.Application.Features.AuditLogs.DTOs.Queries;

public class AuditLogPaginatedRequest
{
    public int PageIndex { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}