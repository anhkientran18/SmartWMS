namespace SmartWMS.Application.Features.InventoryManagement.DTOs.Queries;

public class SlottingRecommendationDto
{
    public string SKU { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string CurrentZone { get; set; } = string.Empty;
    public string SuggestedZone { get; set; } = string.Empty;
    public string VelocityClass { get; set; } = string.Empty;
    public string AIReasoning { get; set; } = string.Empty;
}