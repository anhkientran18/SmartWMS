using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InventoryManagement.Queries.GetStockHistory.Dtos; // Import danh mục DTO mới tách
using System;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.InventoryManagement.Queries.GetStockHistory;

public class GetStockHistoryQuery : IRequest<Result<List<StockHistoryDto>>>
{
    // Định danh sản phẩm (Để trống/null nếu muốn xem lịch sử biến động của toàn bộ các mặt hàng)
    public Guid? ProductId { get; set; }

    // Bộ lọc phân loại nghiệp vụ giao dịch (INBOUND, OUTBOUND, TRANSFER, ADJUSTMENT)
    public string TransactionType { get; set; } = string.Empty;
}