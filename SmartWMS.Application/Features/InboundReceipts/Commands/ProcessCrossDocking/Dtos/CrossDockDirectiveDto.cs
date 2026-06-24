namespace SmartWMS.Application.Features.InboundReceipts.Commands.ProcessCrossDocking.Dtos;

public class CrossDockDirectiveDto
{
    public bool IsCrossDockEligible { get; set; }
    public int CrossDockQuantity { get; set; }
    public int RemainingPutawayQuantity { get; set; }
    public string TargetOutboundDock { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}