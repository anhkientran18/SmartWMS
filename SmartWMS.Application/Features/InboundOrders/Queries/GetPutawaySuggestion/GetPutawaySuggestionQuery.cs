using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InboundOrders.Queries.GetPutawaySuggestion.Dtos; // Import namespace DTO mới
using System;

namespace SmartWMS.Application.Features.InboundOrders.Queries.GetPutawaySuggestion;

public class GetPutawaySuggestionQuery : IRequest<Result<PutawaySuggestionDto>>
{
    public Guid ProductId { get; set; }

    // Số lượng hàng thực tế cần hệ thống tìm vị trí kệ tối ưu để cất
    public int IncomingQuantity { get; set; }

    // Phân khu chỉ định bắt buộc (Ví dụ: Khu lạnh, khu mát, khu hàng giá trị cao)
    public Guid ZoneId { get; set; }
}