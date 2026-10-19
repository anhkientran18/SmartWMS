using MediatR;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Products.DTOs;
using SmartWMS.Application.Features.Products.Specifications.Queries;
using SmartWMS.Domain.Entities;
using System;
using System.Globalization;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Products.Queries.ParseBarcode;

public sealed class ParseBarcodeQueryHandler(IUnitOfWork unitOfWork)
    : IRequestHandler<ParseBarcodeQuery, Result<ParsedBarcodeDto>>
{
    public async Task<Result<ParsedBarcodeDto>> Handle(ParseBarcodeQuery request, CancellationToken cancellationToken)
    {
        var raw = request.RequestData?.RawBarcodeData?.Trim();
        if (string.IsNullOrWhiteSpace(raw) || raw.Length > 163)
            return Result<ParsedBarcodeDto>.Failure(ErrorCodeConstants.ValidationError, "Dữ liệu mã quét trống hoặc quá dài.");

        var code = raw;
        var includeSku = true;
        var includeBarcode = true;
        string? qrBarcode = null;
        var lot = string.Empty;
        DateTime? expiry = null;
        var segments = raw.Split('|');

        if (raw.StartsWith("SKU:", StringComparison.Ordinal))
        {
            // Product QR: SKU:<sku>|BARCODE:<barcode>. Explicit SKU:<sku> is also accepted.
            if (segments.Length > 2 || (segments.Length == 2 && !segments[1].StartsWith("BARCODE:", StringComparison.Ordinal)))
                return InvalidFormat();
            code = segments[0][4..];
            includeBarcode = false;
            if (segments.Length == 2) qrBarcode = segments[1][8..];
        }
        else if (raw.StartsWith("BARCODE:", StringComparison.Ordinal))
        {
            if (segments.Length != 1) return InvalidFormat();
            code = raw[8..];
            includeSku = false;
        }
        else if (segments.Length > 1)
        {
            // Legacy label: <sku>|<lot>[|yyyy-MM-dd]. The first field is always a SKU.
            if (segments.Length > 3) return InvalidFormat();
            code = segments[0];
            includeBarcode = false;
            lot = string.IsNullOrWhiteSpace(segments[1]) ? "LOT-DEFAULT" : segments[1];
            if (segments.Length == 3 && !string.IsNullOrWhiteSpace(segments[2]))
            {
                if (!DateTime.TryParseExact(segments[2], "yyyy-MM-dd", CultureInfo.InvariantCulture,
                    DateTimeStyles.None, out var date)) return InvalidFormat();
                expiry = DateTime.SpecifyKind(date, DateTimeKind.Utc);
            }
        }

        if (string.IsNullOrWhiteSpace(code)) return InvalidFormat();
        var matches = await unitOfWork.Repository<Product>().ListAsync(
            new ProductScanLookupSpec(code, includeSku, includeBarcode), cancellationToken);
        if (matches.Count == 0)
            return Result<ParsedBarcodeDto>.Failure(ErrorCodeConstants.ProductNotFound, "Không tìm thấy sản phẩm đang hoạt động khớp mã quét.");
        if (matches.Count != 1)
            return Result<ParsedBarcodeDto>.Failure(ErrorCodeConstants.ValidationError, "Mã quét mơ hồ giữa SKU và Barcode. Hãy dùng SKU:<sku> hoặc BARCODE:<barcode>.");

        var product = matches[0];
        if (qrBarcode != null && !string.Equals(qrBarcode, product.Barcode ?? string.Empty, StringComparison.Ordinal))
            return Result<ParsedBarcodeDto>.Failure(ErrorCodeConstants.ValidationError, "SKU và Barcode trong QR không khớp cùng sản phẩm.");

        return Result<ParsedBarcodeDto>.Success(new ParsedBarcodeDto
        {
            ProductId = product.Id,
            SKU = product.SKU,
            ProductName = product.Name,
            LotNumber = lot,
            ExpirationDate = expiry
        }, "Giải mã thông tin tem hàng hóa thành công.");
    }

    private static Result<ParsedBarcodeDto> InvalidFormat() =>
        Result<ParsedBarcodeDto>.Failure(ErrorCodeConstants.ValidationError, "Định dạng mã quét hoặc ngày hết hạn không hợp lệ.");
}
