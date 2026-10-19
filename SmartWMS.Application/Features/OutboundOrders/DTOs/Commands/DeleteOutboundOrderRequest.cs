using System;

namespace SmartWMS.Application.Features.OutboundOrders.DTOs.Commands;

public class DeleteOutboundOrderRequest
{
    public Guid Id { get; set; }
}