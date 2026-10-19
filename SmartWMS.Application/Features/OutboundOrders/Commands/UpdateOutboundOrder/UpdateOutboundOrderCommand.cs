using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.OutboundOrders.DTOs.Commands;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.UpdateOutboundOrder;

public record UpdateOutboundOrderCommand(UpdateOutboundOrderRequest RequestData) : IRequest<Result<bool>>;