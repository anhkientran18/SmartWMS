using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Dashboard.Queries.GetDashboardInsightQuery.Dtos; // Import namespace DTO mới tách

namespace SmartWMS.Application.Features.Dashboard.Queries.GetDashboardInsightQuery;

// Định nghĩa Query sạch, đóng vai trò là một Trigger kích hoạt luồng lấy dữ liệu Dashboard
public record GetDashboardInsightQuery : IRequest<Result<DashboardInsightDto>>;