using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.OutboundOrders.DTOs.Commands;
using System;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.ShipOutboundOrder;

public record ShipOutboundOrderCommand(Guid OrderId, ShipOutboundOrderRequest RequestData) : IRequest<Result<bool>>;
