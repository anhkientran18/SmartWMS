using Microsoft.AspNetCore.SignalR;
using SmartWMS.Application.Common.Interfaces;
using SmartWMS.Application.Common.Models;

namespace SmartWMS.Infrastructure.SignalR;

public class InventoryNotificationService : IInventoryNotificationService
{
    private readonly IHubContext<InventoryHub> _hubContext;

    public InventoryNotificationService(IHubContext<InventoryHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public async Task SendToGroupAsync(string groupName, string method, object data)
    {
        await _hubContext.Clients.Group(groupName).SendAsync(method, data);
    }

    // BỔ SUNG: Phát broadcast dữ liệu cập nhật tồn kho thời gian thực cho toàn bộ hệ thống
    public async Task SendInventoryUpdateAsync(InventoryUpdateModel model)
    {
        // Gửi sự kiện "ReceiveInventoryUpdate" kèm data xuống cho cả Web Dashboard và Mobile App
        await _hubContext.Clients.All.SendAsync("ReceiveInventoryUpdate", model);
    }
}