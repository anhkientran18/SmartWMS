using System;

namespace SmartWMS.Application.Features.InventoryManagement.DTOs.Queries;

public class StockHistoryPaginatedRequest
{
    public int PageIndex { get; set; } = 1;
    public int PageSize { get; set; } = 10;
    public Guid? ProductId { get; set; } // Lọc theo sản phẩm (Thẻ kho)
    public string? TransactionType { get; set; } // Lọc theo loại giao dịch
}