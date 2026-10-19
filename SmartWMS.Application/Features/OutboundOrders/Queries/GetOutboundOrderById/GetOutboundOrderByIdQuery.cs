using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.OutboundOrders.DTOs;
using SmartWMS.Application.Features.OutboundOrders.DTOs.Queries;

namespace SmartWMS.Application.Features.OutboundOrders.Queries.GetOutboundOrderById;

public record GetOutboundOrderByIdQuery(OutboundOrderByIdQueryRequest RequestData) : IRequest<Result<OutboundOrderDto>>;