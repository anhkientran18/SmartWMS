using System;

namespace SmartWMS.Application.Features.InboundReceipts.DTOs.Queries;

public class PutawaySuggestionDto
{
    public Guid BinId { get; set; }
    public string BinCode { get; set; } = string.Empty;
    public string ZoneName { get; set; } = string.Empty;
    public double AvailableSpaceBeforePutaway { get; set; }
}