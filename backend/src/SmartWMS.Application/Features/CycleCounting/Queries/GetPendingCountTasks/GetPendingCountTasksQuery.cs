using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.CycleCounting.DTOs.Queries; // Import danh mục DTO mới tách
using System.Collections.Generic;

namespace SmartWMS.Application.Features.CycleCounting.Queries.GetPendingCountTasks;

public class GetPendingCountTasksQuery : IRequest<Result<List<CycleCountTaskDto>>>
{
    // Tên tài khoản nhân viên hiện trường gửi lên để lọc danh sách việc được giao
    public string OperatorName { get; set; } = string.Empty;
}