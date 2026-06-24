using System;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.CreateWavePickTask.Dtos;

public class WavePickAllocationZoneDto
{
    public Guid BinId { get; set; }
    public string BinCode { get; set; } = string.Empty;
    public string LotNumber { get; set; } = string.Empty; // Khớp cấu hình thực tế số lô
    public int QuantityToPick { get; set; } // Số lượng cần bốc tại ô kệ cụ thể này
}