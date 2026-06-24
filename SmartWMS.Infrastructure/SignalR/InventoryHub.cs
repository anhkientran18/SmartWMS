using Microsoft.AspNetCore.SignalR;
using System;
using System.Threading.Tasks;

namespace SmartWMS.Infrastructure.SignalR;

public class InventoryHub : Hub
{
    // Khi một thiết bị kết nối vào trạm kho vận
    public override async Task OnConnectedAsync()
    {
        await Clients.Caller.SendAsync("ReceiveConnectionStatus", "Kết nối thành công tới máy chủ thời gian thực SmartWMS Center.");
        await base.OnConnectedAsync();
    }
}