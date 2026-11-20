using MediatR;
using SmartWMS.Application.Common.Interfaces;
using System.Threading;
using System.Threading.Tasks;

namespace SmartWMS.Application.Common.Events;

public class InventoryChangedEventHandler : INotificationHandler<InventoryChangedEvent>
{
    private readonly IInventoryHubService _hubService;

    public InventoryChangedEventHandler(IInventoryHubService hubService)
    {
        _hubService = hubService;
    }

    public async Task Handle(InventoryChangedEvent notification, CancellationToken cancellationToken)
    {
        // 1. Phát sóng tín hiệu yêu cầu tất cả các màn hình Dashboard Frontend tự động kéo lại dữ liệu mới nhất
        await _hubService.BroadcastDashboardUpdateAsync(new
        {
            TriggeredByEvent = notification.EventType,
            SystemMessage = notification.Message,
            Time = notification.Timestamp
        });

        // 2. Nếu là sự cố nghiêm trọng (Hàng hỏng/Cách ly), đẩy cảnh báo khẩn cấp đến thiết bị hiện trường
        if (notification.EventType == "QUARANTINE_HOLD")
        {
            await _hubService.SendAlertToOperatorsAsync("WARNING", $"Cảnh báo hiện trường: {notification.Message}");
        }
    }
}