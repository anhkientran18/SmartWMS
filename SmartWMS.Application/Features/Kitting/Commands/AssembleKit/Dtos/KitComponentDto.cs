using System;

namespace SmartWMS.Application.Features.Kitting.Commands.AssembleKit.Dtos;

public class KitComponentDto
{
    public Guid ProductId { get; set; }

    // Số lượng linh kiện thành phần cần dùng để cấu thành nên 1 bộ Combo/Kit tổng thể
    public int QuantityPerKit { get; set; }
}