using System;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.InboundReceipts.DTOs.Commands;

public class UpdateInboundReceiptRequest
{
    public Guid Id { get; set; }
    public Guid? BinId { get; set; }
    public Guid? SupplierId { get; set; }
    public DateTime ExpectedDeliveryDate { get; set; }
    public string ReferenceDocument { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
    public List<UpdateInboundReceiptItemRequest> Items { get; set; } = new();
}

public class UpdateInboundReceiptItemRequest
{
    public Guid ProductId { get; set; }
    public int ExpectedQuantity { get; set; }
}