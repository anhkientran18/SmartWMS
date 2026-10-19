using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Dashboard.DTOs.Queries;

namespace SmartWMS.Application.Features.Dashboard.Queries.GetAIAgentMetrics;

public record GetAIAgentMetricsQuery : IRequest<Result<AIAgentMetricsDto>>;
