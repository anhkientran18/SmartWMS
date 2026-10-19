using System;

namespace SmartWMS.Application.Features.Dashboard.DTOs.Queries;

public class AIAgentMetricsDto
{
    public string RecurringJobId { get; set; } = string.Empty;
    public bool IsRegistered { get; set; }
    public DateTime? RegisteredAtUtc { get; set; }
    public string? Cron { get; set; }
    public string? TimeZoneId { get; set; }
    public DateTime? LastScheduledExecutionAtUtc { get; set; }
    public DateTime? NextScheduledExecutionAtUtc { get; set; }
    public string? LastJobId { get; set; }
    public string? LastJobState { get; set; }
}
