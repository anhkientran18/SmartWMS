using Microsoft.AspNetCore.SignalR;
using System;
using Microsoft.AspNetCore.Authorization;
using System.Threading.Tasks;

namespace SmartWMS.Infrastructure.SignalR;

[Authorize]
public class InventoryHub : Hub
{
    // Khi một thiết bị kết nối vào trạm kho vận
    public override async Task OnConnectedAsync()
    {
        if (Context.User?.IsInRole("WarehouseManager") == true)
            await Groups.AddToGroupAsync(Context.ConnectionId, "WarehouseManagers");

        await Clients.Caller.SendAsync("ReceiveConnectionStatus", "Kết nối thành công tới máy chủ thời gian thực SmartWMS Center.");
        await base.OnConnectedAsync();
    }
}
