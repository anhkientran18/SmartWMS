using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.Products.Queries.ParseBarcode.Dtos; // Import namespace Dtos mới

namespace SmartWMS.Application.Features.Products.Queries.ParseBarcode;

public class ParseBarcodeQuery : IRequest<Result<ParsedBarcodeDto>>
{
    // Chuỗi dữ liệu thô nhận được từ tia quét của súng PDA cầm tay
    public string RawBarcodeData { get; set; } = string.Empty;
}