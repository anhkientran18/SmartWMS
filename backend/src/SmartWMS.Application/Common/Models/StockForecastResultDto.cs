namespace SmartWMS.Application.Common.Models;

public class StockForecastResultDto
{
    public string Sku { get; set; } = string.Empty;
    public int PredictedDemand { get; set; }
    public int RecommendedSafetyStock { get; set; }
    public string ForecastSource { get; set; } = string.Empty;
    public string AnalysisReasoning { get; set; } = string.Empty;
}