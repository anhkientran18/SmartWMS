using System;
using System.Collections.Generic;

namespace SmartWMS.Application.Features.InboundReceipts.DTOs.Commands;

public class ReceiveInboundReceiptRequest
{
    public Guid InboundReceiptId { get; set; }

    // Danh sách các mặt hàng nhân viên kho vừa kiểm đếm xong
    public List<ReceiveItemRequest> ReceivedItems { get; set; } = new();
}

public class ReceiveItemRequest
{
    public Guid ItemId { get; set; } // Khóa chính của dòng InboundReceiptItem
    public int QuantityReceived { get; set; } // Số lượng thực tế quét được
}