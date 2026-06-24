using MediatR;
using System;

namespace SmartWMS.Application.Common.Events;

public class InventoryChangedEvent : INotification
{
    public string EventType { get; set; } = string.Empty; // Ví dụ: "WAVE_PICKED", "QUARANTINE_HOLD"
    public string Message { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}