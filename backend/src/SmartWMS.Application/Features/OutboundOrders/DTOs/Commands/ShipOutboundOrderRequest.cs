using System.Collections.Generic;

namespace SmartWMS.Application.Features.OutboundOrders.DTOs.Commands;

public class ShipOutboundOrderRequest
{
    public List<ValidatePackingWeightRequest> PackingChecks { get; set; } = new();
}
