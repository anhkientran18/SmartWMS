using System;

namespace SmartWMS.Application.Features.InboundReceipts.Queries.GetPutawaySuggestion.Dtos;

public class PutawaySuggestionDto
{
    public Guid BinId { get; set; }
    public string BinCode { get; set; } = string.Empty;
    public string ZoneName { get; set; } = string.Empty;

    // Sức chứa ô kệ khả dụng trước khi đưa hàng vào (Đơn vị double đồng bộ Master Data)
    public double AvailableSpaceBeforePutaway { get; set; }
}