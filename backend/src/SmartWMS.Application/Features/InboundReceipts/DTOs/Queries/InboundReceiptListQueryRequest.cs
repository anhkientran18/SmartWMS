using System;

namespace SmartWMS.Application.Features.InboundReceipts.DTOs.Queries;

public class InboundReceiptListQueryRequest
{
    public Guid? SupplierId { get; set; }
    public string? Status { get; set; }
    public string? SearchKeyword { get; set; }
}