using System.Collections.Generic;

namespace SmartWMS.Application.Features.AuditLogs.Queries.Dtos;

public class AuditLogPaginationDto
{
    public int TotalRecords { get; set; }
    public int TotalPages { get; set; }
    public List<AuditLogDto> Logs { get; set; } = new();
}