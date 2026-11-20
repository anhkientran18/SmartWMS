using System;

namespace SmartWMS.Application.Features.Dashboard.DTOs.Queries;

public class InboundOutboundChartPointDto
{
    public DateTime DateUtc { get; set; }
    public long InboundQuantity { get; set; }
    public long OutboundQuantity { get; set; }
}
