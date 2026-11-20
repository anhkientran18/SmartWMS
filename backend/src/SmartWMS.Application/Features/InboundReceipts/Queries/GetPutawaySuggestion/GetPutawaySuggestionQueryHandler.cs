using MediatR;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InboundReceipts.DTOs.Queries;
using SmartWMS.Application.Features.InboundReceipts.Specifications.Queries;
using SmartWMS.Application.Features.Products.Specifications.Queries;
using SmartWMS.Domain.Entities;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Features.InboundReceipts.Queries.GetPutawaySuggestion;

public class GetPutawaySuggestionQueryHandler : IRequestHandler<GetPutawaySuggestionQuery, Result<PutawaySuggestionDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    public GetPutawaySuggestionQueryHandler(IUnitOfWork unitOfWork) => _unitOfWork = unitOfWork;

    public async Task<Result<PutawaySuggestionDto>> Handle(GetPutawaySuggestionQuery request, CancellationToken cancellationToken)
    {
        var reqData = request.RequestData;

        // Trình biên dịch giờ đã hiểu rõ ProductBySkuSpec lấy từ namespace của Product
        var product = await _unitOfWork.Repository<Product>().GetEntityWithSpecAsync(new ProductBySkuSpec(reqData.SKU), cancellationToken);

        if (product == null) return Result<PutawaySuggestionDto>.Failure("Mã SKU sản phẩm không tồn tại trong hệ thống.");

        string targetZoneName = "Khu Khô (Dry Zone)";
        string productInfo = $"{product.Name} {product.Description}".ToLower();

        if (productInfo.Contains("lạnh") || productInfo.Contains("mát") || productInfo.Contains("đông lạnh") || productInfo.Contains("fresh"))
        {
            targetZoneName = "Khu Mát (Cold Zone)";
        }

        var spec = new BinForPutawaySpec(targetZoneName, reqData.Quantity);
        var optimalBin = await _unitOfWork.Repository<Bin>().GetEntityWithSpecAsync(spec, cancellationToken);

        if (optimalBin == null)
            return Result<PutawaySuggestionDto>.Failure("Hệ thống cấu trúc ô kệ của kho đã quá tải, không còn vị trí khả dụng.");

        return Result<PutawaySuggestionDto>.Success(new PutawaySuggestionDto
        {
            BinId = optimalBin.Id,
            BinCode = optimalBin.Code ?? string.Empty,
            ZoneName = optimalBin.Zone?.Name ?? "Unassigned Zone",
            AvailableSpaceBeforePutaway = optimalBin.MaxCapacity - optimalBin.CurrentOccupancy
        });
    }
}