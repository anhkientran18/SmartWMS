using System;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.CreateWavePickTask.Dtos;

public class ConsolidatedPickItemDto
{
    public Guid ProductId { get; set; }
    public string SKU { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;

    // Tổng số lượng cần nhặt của mặt hàng này gom từ tất cả các đơn trong đợt sóng
    public int TotalRequiredQuantity { get; set; }

    // Danh sách chi tiết các ô kệ được thuật toán chỉ định đến bốc hàng
    public List<WavePickAllocationZoneDto> AssignedLocations { get; set; } = new();
}