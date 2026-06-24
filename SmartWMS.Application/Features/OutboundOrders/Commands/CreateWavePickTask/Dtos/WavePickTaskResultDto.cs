using System.Collections.Generic;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.CreateWavePickTask.Dtos;

public class WavePickTaskResultDto
{
    // Mã đợt sóng bốc hàng tự động (Ví dụ: WAVE-20260622-452)
    public string WaveCode { get; set; } = string.Empty;

    // Tổng số lượng đơn hàng xuất kho được gộp xử lý trong đợt này
    public int TotalOrdersProcessed { get; set; }

    // Danh sách tập hợp các chỉ thị nhặt hàng tổng hợp đã tối ưu lộ trình
    public List<ConsolidatedPickItemDto> ConsolidatedPickInstructions { get; set; } = new();
}