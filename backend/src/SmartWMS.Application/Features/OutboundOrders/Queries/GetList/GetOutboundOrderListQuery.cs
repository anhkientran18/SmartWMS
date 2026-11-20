using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.OutboundOrders.DTOs;
using SmartWMS.Application.Features.OutboundOrders.DTOs.Queries;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.OutboundOrders.Queries.GetList;

public record GetOutboundOrderListQuery(OutboundOrderListQueryRequest RequestData) : IRequest<Result<List<OutboundOrderDto>>>;