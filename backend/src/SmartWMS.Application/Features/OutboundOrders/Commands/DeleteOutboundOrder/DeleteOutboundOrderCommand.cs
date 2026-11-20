using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.OutboundOrders.DTOs.Commands;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.DeleteOutboundOrder;

public record DeleteOutboundOrderCommand(DeleteOutboundOrderRequest RequestData) : IRequest<Result<bool>>;