using SmartWMS.Application.Common.Models;

namespace SmartWMS.Application.Common.Interfaces;

public interface IInventoryNotificationService
{
    // Bổ sung phương thức này vào interface để các service khác có thể gọi
    Task SendToGroupAsync(string groupName, string method, object data);
    Task SendInventoryUpdateAsync(InventoryUpdateModel model);
}