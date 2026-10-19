namespace SmartWMS.Application.Features.InboundReceipts.DTOs.Queries;

public class PutawaySuggestionRequest
{
    public string SKU { get; set; } = string.Empty;
    public int Quantity { get; set; }
}