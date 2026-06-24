namespace SmartWMS.Application.Features.Dashboard.Queries.GetDashboardInsightQuery.Dtos;

public class DashboardInsightDto
{
    // Tổng số lượng danh mục sản phẩm đang quản lý trong kho
    public int TotalProducts { get; set; }

    // Tổng số lượng ô kệ (Bin) hiện có trong sơ đồ kho
    public int TotalBins { get; set; }

    // Tỷ lệ lấp đầy hình học tổng thể của toàn kho (Đơn vị: %)
    public double OverallOccupancyPercentage { get; set; }

    // Đoạn văn bản phân tích nghiệp vụ và lời khuyên tối ưu không gian từ mô hình AI
    public string AiExecutiveSummary { get; set; } = string.Empty;
}