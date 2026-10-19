using System;
namespace SmartWMS.Application.Features.OutboundOrders.DTOs.Queries;

public class OutboundOrderByIdQueryRequest
{
    public Guid Id { get; set; }
}