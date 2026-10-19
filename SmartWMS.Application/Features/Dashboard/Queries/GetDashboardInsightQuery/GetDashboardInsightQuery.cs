using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Dashboard.DTOs.Queries;

namespace SmartWMS.Application.Features.Dashboard.Queries.GetDashboardInsightQuery;

public record GetDashboardInsightQuery(DashboardInsightQueryRequest RequestData) : IRequest<Result<DashboardInsightDto>>;