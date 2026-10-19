using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.OutboundOrders.DTOs.Commands;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.CreateWavePickTask;

// Trả về string (có thể là WaveCode hoặc mô tả kết quả gom chuyến)
public record CreateWavePickTaskCommand(CreateWavePickRequest RequestData) : IRequest<Result<string>>;