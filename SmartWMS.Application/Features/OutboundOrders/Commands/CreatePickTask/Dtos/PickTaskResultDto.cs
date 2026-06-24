using System;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.OutboundOrders.Commands.CreatePickTask.Dtos;

public class PickTaskResultDto
{
    public Guid ProductId { get; set; }
    public int TotalAllocatedQuantity { get; set; }
    public bool IsFullyAllocated { get; set; }

    // Tập hợp danh sách các chỉ thị bốc hàng chi tiết tại từng kệ
    public List<PickInstructionItemDto> PickInstructions { get; set; } = new();
}