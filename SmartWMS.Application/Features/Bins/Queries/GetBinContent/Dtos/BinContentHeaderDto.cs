using System;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.Bins.Queries.GetBinContent.Dtos;

public class BinContentHeaderDto
{
    public Guid BinId { get; set; }
    public string BinCode { get; set; } = string.Empty;

    // Định dạng kiểu double đồng bộ với cấu hình Master Data tổng kho
    public double MaxCapacity { get; set; }
    public double CurrentOccupancy { get; set; }

    // Tỷ lệ lấp đầy hiện tại của ô kệ (Đơn vị: %)
    public double UtilizationPercentage { get; set; }

    // Danh sách các mặt hàng thực tế đang nằm trong ô kệ này
    public List<BinInventoryItemDto> Items { get; set; } = new();
}