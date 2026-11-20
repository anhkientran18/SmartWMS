using System;
namespace SmartWMS.Application.Features.InboundReceipts.DTOs.Queries;

public class InboundReceiptByIdQueryRequest
{
    public Guid Id { get; set; }
}