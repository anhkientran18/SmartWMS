using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Dashboard.DTOs.Queries;

namespace SmartWMS.Application.Features.Dashboard.Queries.GetWarehouseDashboard;

public record GetWarehouseDashboardQuery(WarehouseDashboardQueryRequest RequestData) : IRequest<Result<WarehouseDashboardDto>>;