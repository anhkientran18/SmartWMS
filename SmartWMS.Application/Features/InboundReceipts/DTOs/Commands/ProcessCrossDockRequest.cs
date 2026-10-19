using System;
namespace SmartWMS.Application.Features.InboundReceipts.DTOs.Commands;

public class ProcessCrossDockRequest
{
    public Guid ProductId { get; set; }
    public int IncomingQuantity { get; set; }
    public string SourceDockCode { get; set; } = "RECEIVING_DOCK";
}