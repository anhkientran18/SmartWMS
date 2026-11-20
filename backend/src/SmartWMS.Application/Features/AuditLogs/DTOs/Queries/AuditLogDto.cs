using System;

namespace SmartWMS.Application.Features.AuditLogs.DTOs.Queries;

public class AuditLogDto
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty; // C - Create, U - Update, D - Delete
    public string TableName { get; set; } = string.Empty;
    public DateTime DateTime { get; set; }
    public string? OldValues { get; set; }
    public string? NewValues { get; set; }
    public string AffectedColumns { get; set; } = string.Empty;
    public string? IpAddress { get; set; }
}