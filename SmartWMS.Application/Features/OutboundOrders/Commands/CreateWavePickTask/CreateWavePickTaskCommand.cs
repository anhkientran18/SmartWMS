using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.OutboundOrders.Commands.CreateWavePickTask.Dtos; // Import thư mục DTO mới tách
using System;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.CreateWavePickTask;

public class CreateWavePickTaskCommand : IRequest<Result<WavePickTaskResultDto>>
{
    // Tiếp nhận tập hợp danh sách các Đơn hàng cần gom xuất kho cùng lúc để xử lý tối ưu Sóng
    public List<Guid> OrderIds { get; set; } = new();
}