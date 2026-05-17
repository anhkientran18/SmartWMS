namespace SmartWMS.Application.Common.Interfaces;

public interface IAgentCapacityService
{
    // Hàm gửi kích thước kệ cho Gemini AI để nhận về sức chứa tối ưu (số lượng thùng tiêu chuẩn)
    Task<int> SuggestOptimizeCapacityAsync(double width, double height, double depth);
}