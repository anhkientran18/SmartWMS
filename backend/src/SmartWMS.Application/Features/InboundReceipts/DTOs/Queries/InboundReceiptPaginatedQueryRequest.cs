namespace SmartWMS.Application.Features.InboundReceipts.DTOs.Queries;

public class InboundReceiptPaginatedQueryRequest
{
    public int PageIndex { get; set; } = 1;
    public int PageSize { get; set; } = 10;
    public string? SearchKeyword { get; set; }
}