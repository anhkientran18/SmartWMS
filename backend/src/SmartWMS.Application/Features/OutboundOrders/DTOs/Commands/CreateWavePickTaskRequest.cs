using System;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.OutboundOrders.DTOs.Commands;

public class CreateWavePickRequest
{
    public List<Guid> OutboundOrderIds { get; set; } = new();
    public string WavePriority { get; set; } = "Normal";
}