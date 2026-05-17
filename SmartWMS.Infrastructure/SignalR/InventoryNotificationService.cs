using Microsoft.AspNetCore.SignalR;
using SmartWMS.Application.Common.Interfaces;

namespace SmartWMS.Infrastructure.SignalR;

public class InventoryNotificationService : IInventoryNotificationService
{
    private readonly IHubContext<InventoryHub> _hubContext;

    public InventoryNotificationService(IHubContext<InventoryHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public async Task NotifyStockUpdateAsync(Guid binId, int quantityChanged, string action)
    {
        // Gửi thông báo tới tất cả các Client đang kết nối với sự kiện tên là "ReceiveStockUpdate"
        var message = $"Kệ {binId} vừa được {action} với số lượng {quantityChanged}.";

        await _hubContext.Clients.All.SendAsync("ReceiveStockUpdate", new
        {
            BinId = binId,
            Quantity = quantityChanged,
            Action = action,
            Message = message,
            Timestamp = DateTime.UtcNow
        });
    }
}