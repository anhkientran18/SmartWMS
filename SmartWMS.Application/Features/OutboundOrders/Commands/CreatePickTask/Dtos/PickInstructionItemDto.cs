using System;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.CreatePickTask.Dtos;

public class PickInstructionItemDto
{
    public Guid BinId { get; set; }
    public string BinCode { get; set; } = string.Empty;

    // ĐÃ ĐỒNG BỘ: Chuẩn số lô hàng hóa trong DB kho vận
    public string LotNumber { get; set; } = string.Empty;
    public int PickQuantity { get; set; }
}