using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Dashboard.DTOs.Queries;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.Dashboard.Queries.GetInboundOutboundChart;

public record GetInboundOutboundChartQuery : IRequest<Result<List<InboundOutboundChartPointDto>>>
{
    public int Days { get; init; } = 7;
}
