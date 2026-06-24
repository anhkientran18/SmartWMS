using Microsoft.AspNetCore.SignalR;
using SmartWMS.Application.Common.Interfaces;
using System.Threading.Tasks;

namespace SmartWMS.Infrastructure.SignalR;

public class InventoryHubService : IInventoryHubService
{
    private readonly IHubContext<InventoryHub> _hubContext;

    public InventoryHubService(IHubContext<InventoryHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public async Task BroadcastDashboardUpdateAsync(object metrics)
    {
        // Gửi tới tất cả các client đang bật màn hình giám sát quản lý
        await _hubContext.Clients.All.SendAsync("RefreshDashboardMetrics", metrics);
    }

    public async Task SendAlertToOperatorsAsync(string alertType, string message)
    {
        // Đẩy thông báo dạng Toast/Pop-up khẩn cấp xuống thiết bị PDA của nhân viên hiện trường
        await _hubContext.Clients.All.SendAsync("ReceiveSystemAlert", new { Type = alertType, Content = message });
    }
}