using System;

namespace SmartWMS.Application.Features.InboundReceipts.DTOs.Commands;

public class DeleteInboundReceiptRequest
{
    public Guid Id { get; set; }
}