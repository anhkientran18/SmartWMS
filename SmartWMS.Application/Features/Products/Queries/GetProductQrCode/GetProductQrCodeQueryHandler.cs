using MediatR;
using SmartWMS.Application.Common.Constants;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Products.Specifications.Queries;
using SmartWMS.Domain.Entities;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.Products.Queries.GetProductQrCode;

public sealed class GetProductQrCodeQueryHandler : IRequestHandler<GetProductQrCodeQuery, Result<string>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IBarcodeService _barcodeService;

    public GetProductQrCodeQueryHandler(IUnitOfWork unitOfWork, IBarcodeService barcodeService)
    {
        _unitOfWork = unitOfWork;
        _barcodeService = barcodeService;
    }

    public async Task<Result<string>> Handle(GetProductQrCodeQuery request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<Product>();
        var spec = new ProductScanLookupSpec(request.RequestData.Sku, includeBarcode: false);
        var product = await repo.GetEntityWithSpecAsync(spec, cancellationToken);

        if (product == null)
            return Result<string>.Failure(ErrorCodeConstants.ProductNotFound, "Không tìm thấy sản phẩm với mã SKU này.");

        if (product.SKU.Contains('|') || (product.Barcode?.Contains('|') ?? false))
            return Result<string>.Failure(ErrorCodeConstants.ValidationError, "SKU/Barcode chứa ký tự phân cách |, không thể tạo QR theo contract hiện tại.");

        string qrPayload = $"SKU:{product.SKU}|BARCODE:{product.Barcode}";
        string base64Image = await _barcodeService.GenerateQrCodeBase64Async(qrPayload);
        string fullBase64DataUri = $"data:image/png;base64,{base64Image}";

        return Result<string>.Success(fullBase64DataUri, "Tạo mã QR thành công.");
    }
}