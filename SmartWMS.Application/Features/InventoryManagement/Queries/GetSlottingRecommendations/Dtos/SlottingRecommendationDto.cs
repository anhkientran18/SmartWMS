namespace SmartWMS.Application.Features.InventoryManagement.Queries.GetSlottingRecommendations.Dtos;

public class SlottingRecommendationDto
{
    public string SKU { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;

    // Vị trí phân khu hiện tại của sản phẩm trong kho
    public string CurrentZone { get; set; } = string.Empty;

    // Phân khu mới tối ưu hơn do AI đề xuất (Ví dụ: Chuyển gần về phía cửa xuất)
    public string SuggestedZone { get; set; } = string.Empty;

    // Phân loại tốc độ luân chuyển hàng: A (Nhanh/Hot-pick), B (Trung bình), C (Chậm)
    public string VelocityClass { get; set; } = string.Empty;

    // Đoạn lập luận logic, giải thích lý do tại sao AI lại đề xuất dịch chuyển phân khu này
    public string AIReasoning { get; set; } = string.Empty;
}