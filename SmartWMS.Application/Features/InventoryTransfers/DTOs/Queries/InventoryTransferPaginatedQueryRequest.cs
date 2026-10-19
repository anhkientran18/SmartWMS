using System;

namespace SmartWMS.Application.Features.InventoryTransfers.DTOs.Queries;

public class InventoryTransferPaginatedQueryRequest
{
    public int PageIndex { get; set; } = 1;
    public int PageSize { get; set; } = 10;
    public Guid? ProductId { get; set; }
    public string? SearchKeyword { get; set; }
}