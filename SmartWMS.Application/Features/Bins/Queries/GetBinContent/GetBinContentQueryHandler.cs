using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Bins.Queries.GetBinContent.Dtos;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Bins.Queries.GetBinContent;

public class GetBinContentQueryHandler : IRequestHandler<GetBinContentQuery, Result<BinContentHeaderDto>>
{
    private readonly IApplicationDbContext _context;

    public GetBinContentQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<BinContentHeaderDto>> Handle(GetBinContentQuery request, CancellationToken cancellationToken)
    {
        var bin = await _context.Bins
            .AsNoTracking()
            .FirstOrDefaultAsync(b => b.Id == request.BinId, cancellationToken);

        if (bin == null)
        {
            return Result<BinContentHeaderDto>.Failure("Không tìm thấy ô kệ yêu cầu trên sơ đồ kho bãi.");
        }

        var inventories = await _context.BinInventories
            .Include(x => x.Product)
            .Where(x => x.BinId == request.BinId)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var headerDto = new BinContentHeaderDto
        {
            BinId = bin.Id,
            BinCode = bin.Code ?? string.Empty,
            MaxCapacity = bin.MaxCapacity,
            CurrentOccupancy = bin.CurrentOccupancy,
            UtilizationPercentage = bin.MaxCapacity > 0
                ? Math.Round((bin.CurrentOccupancy / bin.MaxCapacity) * 100, 2)
                : 0.0
        };

        foreach (var inv in inventories)
        {
            headerDto.Items.Add(new BinInventoryItemDto
            {
                ProductId = inv.ProductId,
                SKU = inv.Product != null ? (inv.Product.SKU ?? string.Empty) : "UNKNOWN",
                ProductName = inv.Product != null ? (inv.Product.Name ?? string.Empty) : "Sản phẩm đã bị xóa",
                LotNumber = inv.LotNumber ?? string.Empty,
                Quantity = inv.Quantity,
                ExpirationDate = inv.ExpirationDate.HasValue
                    ? inv.ExpirationDate.Value.ToString("yyyy-MM-dd")
                    : "Không có hạn dùng",
                // 🌟 ĐÃ SỬA: Chuyển đổi Enum sang định dạng String để map khớp với cấu trúc DTO hiển thị
                Status = inv.Status.ToString()
            });
        }

        return Result<BinContentHeaderDto>.Success(headerDto);
    }
}