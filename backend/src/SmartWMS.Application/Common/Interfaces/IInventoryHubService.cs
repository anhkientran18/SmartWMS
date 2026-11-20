using System.Threading.Tasks;

namespace SmartWMS.Application.Common.Interfaces;

public interface IInventoryHubService
{
    // Gửi thông báo cập nhật số liệu Dashboard tổng quan thời gian thực
    Task BroadcastDashboardUpdateAsync(object metrics);

    // Đẩy chỉ thị thông báo khẩn cấp (Ví dụ: Phát hiện hàng hỏng, khóa kho) xuống PDA thiết bị
    Task SendAlertToOperatorsAsync(string alertType, string message);
}