using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Products.Queries.ParseBarcode.Dtos;
using System.Globalization;

namespace SmartWMS.Application.Features.Products.Queries.ParseBarcode;

public class ParseBarcodeQueryHandler : IRequestHandler<ParseBarcodeQuery, Result<ParsedBarcodeDto>>
{
    private readonly IApplicationDbContext _context;

    public ParseBarcodeQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<ParsedBarcodeDto>> Handle(ParseBarcodeQuery request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.RawBarcodeData))
        {
            return Result<ParsedBarcodeDto>.Failure("Dữ liệu mã vạch quét từ thiết bị trống.");
        }

        string rawData = request.RawBarcodeData.Trim();
        string extractedSku = string.Empty;
        string extractedLot = "LOT-DEFAULT";
        DateTime? extractedExpiry = null;

        try
        {
            // GIẢ LẬP ĐỊNH DẠNG TEM KHO DOANH NGHIỆP: SKU|LOT|EXPIRY_DATE (Ví dụ: COCA330|LOT2026A|2026-12-31)
            if (rawData.Contains('|'))
            {
                var segments = rawData.Split('|');
                if (segments.Length > 0) extractedSku = segments[0];
                if (segments.Length > 1) extractedLot = segments[1];
                if (segments.Length > 2 && DateTime.TryParseExact(segments[2], "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out DateTime parsedDate))
                {
                    extractedExpiry = DateTime.SpecifyKind(parsedDate, DateTimeKind.Utc);
                }
            }
            else
            {
                // Fallback: Nếu là chuỗi mã đơn lẻ, hệ thống coi toàn bộ chuỗi là mã SKU gốc
                extractedSku = rawData;
            }

            // 2. Đối chiếu mã SKU vừa bóc tách với Master Data của hệ thống
            var product = await _context.Products
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.SKU == extractedSku, cancellationToken);

            if (product == null)
            {
                return Result<ParsedBarcodeDto>.Failure($"Mã vạch không hợp lệ! Không tìm thấy sản phẩm nào có mã SKU '{extractedSku}' trong danh mục.");
            }

            // 3. Đóng gói dữ liệu đầu ra an toàn Nullable
            var resultDto = new ParsedBarcodeDto
            {
                ProductId = product.Id,
                SKU = product.SKU ?? string.Empty,
                ProductName = product.Name ?? string.Empty,
                LotNumber = string.IsNullOrWhiteSpace(extractedLot) ? "LOT-DEFAULT" : extractedLot,
                ExpirationDate = extractedExpiry
            };

            return Result<ParsedBarcodeDto>.Success(resultDto, "Giải mã thông tin tem hàng hóa thành công.");
        }
        catch (Exception ex)
        {
            return Result<ParsedBarcodeDto>.Failure($"Lỗi xử lý giải mã cấu trúc mã vạch biến động: {ex.Message}");
        }
    }
}