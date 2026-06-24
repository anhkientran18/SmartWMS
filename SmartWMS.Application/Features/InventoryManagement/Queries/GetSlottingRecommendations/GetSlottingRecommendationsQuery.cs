using MediatR;
using SmartWMS.Application.Common.Models;
using SmartWMS.Application.Features.InventoryManagement.Queries.GetSlottingRecommendations.Dtos; // Import namespace DTO mới tách
using System.Collections.Generic;

namespace SmartWMS.Application.Features.InventoryManagement.Queries.GetSlottingRecommendations;

public class GetSlottingRecommendationsQuery : IRequest<Result<List<SlottingRecommendationDto>>>
{
    // Cầu nối truy vấn số liệu phân tích layout tổng kho từ AI (Không cần tham số đầu vào phức tạp)
}