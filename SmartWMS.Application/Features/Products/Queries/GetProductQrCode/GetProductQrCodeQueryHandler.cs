using MediatR;
using Microsoft.EntityFrameworkCore;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;

namespace SmartWMS.Application.Features.Products.Queries.GetProductQrCode;

public class GetProductQrCodeQueryHandler : IRequestHandler<GetProductQrCodeQuery, Result<string>>
{
    private readonly IApplicationDbContext _context;
    private readonly IBarcodeService _barcodeService;

    public GetProductQrCodeQueryHandler(IApplicationDbContext context, IBarcodeService barcodeService)
    {
        _context = context;
        _barcodeService = barcodeService;
    }

    public async Task<Result<string>> Handle(GetProductQrCodeQuery request, CancellationToken cancellationToken)
    {
        // 1. Tìm sản phẩm trong DB
        var product = await _context.Products
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.SKU == request.Sku, cancellationToken);

        if (product == null)
            return Result<string>.Failure("Không tìm thấy sản phẩm với mã SKU này.");

        // 2. Tạo nội dung dữ liệu sẽ được nhúng vào bên trong mã QR
        // Ở thực tế, dữ liệu này máy quét sẽ đọc được. Ta định dạng theo chuẩn chuỗi cách nhau bởi dấu gạch đứng (|)
        string qrPayload = $"SKU:{product.SKU}|BARCODE:{product.Barcode}";

        // 3. Sinh ảnh QR Code
        string base64Image = await _barcodeService.GenerateQrCodeBase64Async(qrPayload);

        // 4. Bổ sung prefix "data:image/png;base64," để Frontend có thể hiển thị ảnh được luôn qua thẻ <img>
        string fullBase64DataUri = $"data:image/png;base64,{base64Image}";

        return Result<string>.Success(fullBase64DataUri, "Tạo mã QR thành công.");
    }
}