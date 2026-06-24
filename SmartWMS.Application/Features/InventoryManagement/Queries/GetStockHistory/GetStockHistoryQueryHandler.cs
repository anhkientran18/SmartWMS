using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InventoryManagement.Queries.GetStockHistory.Dtos;
using SmartWMS.Domain.Entities; // BỔ SUNG: Khớp định dạng kiểu dữ liệu thực thể lịch sử
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.InventoryManagement.Queries.GetStockHistory;

public class GetStockHistoryQueryHandler : IRequestHandler<GetStockHistoryQuery, Result<List<StockHistoryDto>>>
{
    private readonly IApplicationDbContext _context;

    public GetStockHistoryQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<List<StockHistoryDto>>> Handle(GetStockHistoryQuery request, CancellationToken cancellationToken)
    {
        // 1. Khởi tạo truy vấn an toàn từ bảng lưu vết Transaction đã được khai báo contract
        var query = _context.InventoryTransactions
            .Include(x => x.Product)
            .AsNoTracking();

        // 2. Áp dụng bộ lọc động theo mã sản phẩm
        if (request.ProductId.HasValue && request.ProductId != Guid.Empty)
        {
            query = query.Where(x => x.ProductId == request.ProductId.Value);
        }

        // 3. Áp dụng bộ lọc động theo loại hình giao dịch
        if (!string.IsNullOrWhiteSpace(request.TransactionType))
        {
            query = query.Where(x => x.TransactionType == request.TransactionType);
        }

        // Sắp xếp nhật ký mới nhất lên trên đầu
        var transactions = await query
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(cancellationToken);

        var resultList = new List<StockHistoryDto>();

        // 4. Ánh xạ dữ liệu cấu trúc an toàn tuyệt đối với lỗi Nullable
        foreach (var tx in transactions)
        {
            resultList.Add(new StockHistoryDto
            {
                Id = tx.Id,
                SKU = tx.Product != null ? (tx.Product.SKU ?? string.Empty) : "UNKNOWN",
                ProductName = tx.Product != null ? (tx.Product.Name ?? string.Empty) : "Sản phẩm đã bị xóa",
                TransactionType = tx.TransactionType ?? "UNKNOWN",
                QuantityChanged = tx.QuantityChanged,
                SourceBinCode = tx.SourceBinCode ?? "N/A",
                DestinationBinCode = tx.DestinationBinCode ?? "N/A",
                ReasonCode = tx.ReasonCode ?? "Routine Operation",
                OperatorName = tx.CreatedBy ?? "SystemAutomated",
                CreatedAt = tx.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss")
            });
        }

        return Result<List<StockHistoryDto>>.Success(resultList, $"Truy xuất thành công nhật ký biến động gồm {resultList.Count} bản ghi.");
    }
}