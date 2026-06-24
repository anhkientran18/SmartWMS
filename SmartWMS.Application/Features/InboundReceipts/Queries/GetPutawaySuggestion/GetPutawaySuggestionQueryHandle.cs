using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InboundReceipts.Queries.GetPutawaySuggestion.Dtos;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.InboundReceipts.Queries.GetPutawaySuggestion;

// Thuật toán định tuyến vị trí thông minh dựa trên đặc tính sản phẩm (Put-away Strategy)
public class GetPutawaySuggestionQueryHandler : IRequestHandler<GetPutawaySuggestionQuery, Result<PutawaySuggestionDto>>
{
    private readonly IApplicationDbContext _context;

    public GetPutawaySuggestionQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<PutawaySuggestionDto>> Handle(GetPutawaySuggestionQuery request, CancellationToken cancellationToken)
    {
        // 1. Kiểm tra sự tồn tại của sản phẩm trong danh mục Master Data
        var product = await _context.Products
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.SKU == request.SKU, cancellationToken);

        if (product == null)
            return Result<PutawaySuggestionDto>.Failure("Mã SKU sản phẩm không tồn tại trong hệ thống.");

        if (request.Quantity <= 0)
            return Result<PutawaySuggestionDto>.Failure("Số lượng hàng cất kho đề xuất phải lớn hơn 0.");

        // 2. PHÂN TÍCH ĐẶC TÍNH SẢN PHẨM: Định tuyến vùng lưu trữ (Zone Matrix)
        string targetZoneName = "Khu Khô (Dry Zone)";
        string productName = product.Name ?? string.Empty;
        string productDesc = product.Description ?? string.Empty;
        string productInfo = (productName + " " + productDesc).ToLower();

        // Nếu phát hiện các từ khóa liên quan đến nhiệt độ, tự động điều hướng sang Khu Mát
        if (productInfo.Contains("lạnh") || productInfo.Contains("mát") || productInfo.Contains("đông lạnh") || productInfo.Contains("fresh"))
        {
            targetZoneName = "Khu Mát (Cold Zone)";
        }

        // 3. THUẬT TOÁN TỐI ƯU HÓA KHÔNG GIAN (Zone-Velocity Put-away)
        // Tìm ô kệ thuộc Zone chỉ định, còn đủ chỗ chứa và ưu tiên ô kệ đang có sẵn hàng (để gom gọn diện tích)
        var optimalBin = await _context.Bins
            .Include(b => b.Zone)
            .Where(b => b.Zone != null &&
                        b.Zone.Name == targetZoneName &&
                        (b.CurrentOccupancy + request.Quantity) <= b.MaxCapacity)
            .OrderByDescending(b => b.CurrentOccupancy)
            .FirstOrDefaultAsync(cancellationToken);

        // Kịch bản dự phòng (Fallback): Nếu Zone tối ưu đã hết sạch chỗ, quét tìm ô kệ bất kỳ còn trống trên toàn kho
        if (optimalBin == null)
        {
            optimalBin = await _context.Bins
                .Include(b => b.Zone)
                .Where(b => b.Zone != null && (b.CurrentOccupancy + request.Quantity) <= b.MaxCapacity)
                .OrderBy(b => b.CurrentOccupancy)
                .FirstOrDefaultAsync(cancellationToken);

            if (optimalBin == null)
                return Result<PutawaySuggestionDto>.Failure("Hệ thống cấu trúc ô kệ của kho đã quá tải, không còn vị trí khả dụng.");
        }

        // 4. Ánh xạ dữ liệu trả về chỉ dẫn cho nhân viên lái xe nâng
        var suggestion = new PutawaySuggestionDto
        {
            BinId = optimalBin.Id,
            BinCode = optimalBin.Code ?? string.Empty,
            ZoneName = optimalBin.Zone != null ? (optimalBin.Zone.Name ?? string.Empty) : "Unassigned Zone",
            AvailableSpaceBeforePutaway = optimalBin.MaxCapacity - optimalBin.CurrentOccupancy
        };

        return Result<PutawaySuggestionDto>.Success(suggestion);
    }
}