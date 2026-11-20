using System;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.CycleCounting.DTOs.Commands;

public class ConfirmCycleCountRequest
{
    public Guid CountSheetId { get; set; }
    public string Notes { get; set; } = string.Empty; // Ghi chú thêm của quản lý sau khi đếm xong
    public List<CycleCountItemRequest> CountedItems { get; set; } = new();
}

public class CycleCountItemRequest
{
    public Guid ItemId { get; set; } // ID của dòng CycleCountItem
    public int? CountedQuantity { get; set; } // Số lượng thực tế nhân viên đếm được
}