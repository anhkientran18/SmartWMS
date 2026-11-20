using System;

namespace SmartWMS.Application.Features.InventoryManagement.DTOs.Queries;

public class SlottingRecommendationRequest
{
    // Có thể truyền ZoneId nếu muốn AI chỉ phân tích sắp xếp lại trong 1 Khu vực cụ thể
    public Guid? ZoneId { get; set; }
}