using System;

namespace SmartWMS.Application.Features.OutboundOrders.DTOs.Queries;

public class OutboundOrderListQueryRequest
{
    public Guid? CustomerId { get; set; }
    public string? Status { get; set; }
    public string? SearchKeyword { get; set; }
}