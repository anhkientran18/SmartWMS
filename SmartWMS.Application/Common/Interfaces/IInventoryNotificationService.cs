namespace SmartWMS.Application.Common.Interfaces;

public interface IInventoryNotificationService
{
    // Hàm này sẽ được gọi mỗi khi kho có biến động
    Task NotifyStockUpdateAsync(Guid binId, int quantityChanged, string action);
}