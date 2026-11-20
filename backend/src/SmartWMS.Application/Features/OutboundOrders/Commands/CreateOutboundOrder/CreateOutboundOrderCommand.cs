using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.OutboundOrders.DTOs.Commands;
using System;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.CreateOutboundOrder;

public record CreateOutboundOrderCommand(CreateOutboundOrderRequest RequestData) : IRequest<Result<Guid>>;