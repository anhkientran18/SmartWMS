using System;

namespace SmartWMS.Application.Features.InboundReceipts.DTOs.Commands;

public class CrossDockResultDto
{
    public Guid ProductId { get; set; }
    public int TotalIncomingQuantity { get; set; }
    public int CrossDockedQuantity { get; set; }
    public int RemainderForPutaway { get; set; }
    public string ExecutionSummary { get; set; } = string.Empty;
}