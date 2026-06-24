using System;

namespace SmartWMS.Application.Features.InboundOrders.Queries.GetPutawaySuggestion.Dtos;

public class PutawaySuggestionDto
{
    public Guid RecommendedBinId { get; set; }
    public string RecommendedBinCode { get; set; } = string.Empty;
    public double RemainingSpaceAfterPutaway { get; set; }
    public string Message { get; set; } = string.Empty;
}