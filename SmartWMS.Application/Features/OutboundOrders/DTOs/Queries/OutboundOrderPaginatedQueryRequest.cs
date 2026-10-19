using System;
namespace SmartWMS.Application.Features.OutboundOrders.DTOs.Queries;

public class OutboundOrderPaginatedQueryRequest
{
    public int PageIndex { get; set; } = 1;
    public int PageSize { get; set; } = 10;
    public string? SearchKeyword { get; set; }
    public Guid? CustomerId { get; set; }
}