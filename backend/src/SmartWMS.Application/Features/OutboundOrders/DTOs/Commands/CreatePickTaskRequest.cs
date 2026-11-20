using System;

namespace SmartWMS.Application.Features.OutboundOrders.DTOs.Commands;

public class CreatePickTaskRequest
{
    public Guid OutboundOrderId { get; set; }
    public Guid? AssignedUserId { get; set; } // Phân công cho nhân viên kho cụ thể (tùy chọn)
}