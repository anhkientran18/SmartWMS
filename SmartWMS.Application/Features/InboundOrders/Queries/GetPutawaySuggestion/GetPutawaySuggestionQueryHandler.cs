using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InboundOrders.Queries.GetPutawaySuggestion.Dtos;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.InboundOrders.Queries.GetPutawaySuggestion;

public class GetPutawaySuggestionQueryHandler : IRequestHandler<GetPutawaySuggestionQuery, Result<PutawaySuggestionDto>>
{
    private readonly IApplicationDbContext _context;

    public GetPutawaySuggestionQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<PutawaySuggestionDto>> Handle(GetPutawaySuggestionQuery request, CancellationToken cancellationToken)
    {
        if (request.IncomingQuantity <= 0)
        {
            return Result<PutawaySuggestionDto>.Failure("Số lượng hàng gợi ý cất kho phải lớn hơn 0.");
        }

        // THUẬT TOÁN ĐỊNH VỊ Ô KỆ (Putaway Strategy):
        // 1. Ô kệ phải thuộc Zone yêu cầu và chưa bị xóa mềm (IsDeleted == false)
        // 2. Sức chứa hiện tại + Lượng hàng mới nhập vào không được vượt quá Sức chứa tối đa (Strict Capacity Constraint)
        // 3. Ưu tiên ô kệ nào đang có hàng sẵn của chính sản phẩm đó để gom cụm (Clustering), nếu không thì chọn ô kệ trống có sức chứa lớn nhất.
        var optimalBin = await _context.Bins
            .Include(b => b.BinInventories)
            .Where(b => b.ZoneId == request.ZoneId && !b.IsDeleted &&
                        (b.CurrentOccupancy + request.IncomingQuantity) <= b.MaxCapacity)
            .OrderByDescending(b => b.BinInventories.Any(i => i.ProductId == request.ProductId)) // Ưu tiên cùng loại sản phẩm
            .ThenBy(b => b.MaxCapacity - b.CurrentOccupancy) // Ưu tiên ô còn rộng hơn
            .FirstOrDefaultAsync(cancellationToken);

        if (optimalBin == null)
        {
            return Result<PutawaySuggestionDto>.Failure("Cảnh báo diện rộng! Toàn bộ các ô kệ thuộc phân khu này đã bị lấp đầy hoặc không còn ô nào đủ sức chứa lô hàng này.");
        }

        var result = new PutawaySuggestionDto
        {
            RecommendedBinId = optimalBin.Id,
            RecommendedBinCode = optimalBin.Code ?? "UNKNOWN",
            RemainingSpaceAfterPutaway = optimalBin.MaxCapacity - (optimalBin.CurrentOccupancy + request.IncomingQuantity),
            Message = $"Hệ thống khuyến nghị cất hàng vào ô {optimalBin.Code}. Vị trí này đảm bảo an toàn tải trọng kệ."
        };

        return Result<PutawaySuggestionDto>.Success(result);
    }
}