using Microsoft.AspNetCore.SignalR;

namespace SmartWMS.Infrastructure.SignalR;

// Client sẽ kết nối tới Hub này
public class InventoryHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        // Có thể log lại khi có thiết bị kết nối thành công
        Console.WriteLine($"Client connected: {Context.ConnectionId}");
        await base.OnConnectedAsync();
    }
}