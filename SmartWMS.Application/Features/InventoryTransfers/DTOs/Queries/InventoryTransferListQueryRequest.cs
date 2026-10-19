using System;

namespace SmartWMS.Application.Features.InventoryTransfers.DTOs.Queries;

public class InventoryTransferListQueryRequest
{
    public Guid? ProductId { get; set; }
    public string? SearchKeyword { get; set; }
}