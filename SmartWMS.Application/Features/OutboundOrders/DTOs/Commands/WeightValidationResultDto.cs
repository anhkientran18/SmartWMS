namespace SmartWMS.Application.Features.OutboundOrders.DTOs.Commands;

public class WeightValidationResultDto
{
    public bool IsValid { get; set; }
    public double ExpectedTotalWeightGrams { get; set; }
    public double ActualWeightGrams { get; set; }
    public double DeviationPercentage { get; set; }
    public string StatusMessage { get; set; } = string.Empty;
}