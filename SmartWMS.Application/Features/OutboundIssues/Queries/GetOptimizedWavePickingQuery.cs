using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.OutboundIssues.Dtos;
using System;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.OutboundIssues.Queries;

public class GetOptimizedWavePickingQuery : IRequest<Result<WavePickingDto>>
{
    // Tập hợp các ID đơn hàng xuất kho được tick chọn từ giao diện để gom đợt nhặt hàng
    public List<Guid> OrderIds { get; set; } = new();
}