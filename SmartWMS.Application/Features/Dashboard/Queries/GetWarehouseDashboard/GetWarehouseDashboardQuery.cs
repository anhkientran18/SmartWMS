using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Dashboard.Queries.GetWarehouseDashboard.Dtos; // Import namespace chứa DTO vừa phân rã

namespace SmartWMS.Application.Features.Dashboard.Queries.GetWarehouseDashboard;

public class GetWarehouseDashboardQuery : IRequest<Result<WarehouseDashboardDto>>
{
    // Truy vấn số liệu dashboard tổng quan không cần tham số đầu vào phức tạp
}