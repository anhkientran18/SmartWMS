using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InboundReceipts.Queries.GetPutawaySuggestion.Dtos; // Import namespace DTO mới tách

namespace SmartWMS.Application.Features.InboundReceipts.Queries.GetPutawaySuggestion;

public class GetPutawaySuggestionQuery : IRequest<Result<PutawaySuggestionDto>>
{
    // Mã SKU nhận diện sản phẩm từ súng quét mã vạch hiện trường
    public string SKU { get; set; } = string.Empty;

    // Số lượng hàng thực tế cần hạ tải xếp vào ô kệ
    public int Quantity { get; set; }
}