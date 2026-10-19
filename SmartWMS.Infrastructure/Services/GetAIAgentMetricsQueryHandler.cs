using Hangfire;
using Hangfire.Storage;
using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Dashboard.DTOs.Queries;
using SmartWMS.Application.Features.Dashboard.Queries.GetAIAgentMetrics;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Infrastructure.Services;

public class GetAIAgentMetricsQueryHandler(JobStorage jobStorage)
    : IRequestHandler<GetAIAgentMetricsQuery, Result<AIAgentMetricsDto>>
{
    public Task<Result<AIAgentMetricsDto>> Handle(GetAIAgentMetricsQuery request, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        const string recurringJobId = "SmartWMS-AI-VirtualAgent-Scan";
        using var connection = jobStorage.GetConnection();
        var job = connection.GetRecurringJobs(new[] { recurringJobId }).SingleOrDefault(x => !x.Removed);

        var metrics = new AIAgentMetricsDto
        {
            RecurringJobId = recurringJobId,
            IsRegistered = job != null,
            RegisteredAtUtc = job?.CreatedAt,
            Cron = job?.Cron,
            TimeZoneId = job?.TimeZoneId,
            LastScheduledExecutionAtUtc = job?.LastExecution,
            NextScheduledExecutionAtUtc = job?.NextExecution,
            LastJobId = job?.LastJobId,
            LastJobState = job?.LastJobState
        };

        return Task.FromResult(Result<AIAgentMetricsDto>.Success(metrics));
    }
}
